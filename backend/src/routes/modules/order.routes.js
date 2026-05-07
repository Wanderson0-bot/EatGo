// Endpoint público responsável por criar pedidos no marketplace.
const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { pool } = require("../../config/database");
const env = require("../../config/env");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const {
  createCheckoutPreference,
  fetchPaymentDetails,
  normalizeMercadoPagoStatus
} = require("../../services/payment.service");
const validate = require("../../middlewares/validate");
const {
  cancelClientOrderSchema,
  createOrderSchema,
  getClientOrdersSchema,
  syncOrderPaymentSchema
} = require("../../schemas/order.schema");

const router = Router();

const createOrderRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

async function syncOrderPayment({
  connection = pool,
  paymentReference,
  paymentId = null,
  normalizedStatus,
  statusDetail = null
}) {
  const [orders] = await connection.query(
    `SELECT
      status,
      pagamento_status
    FROM pedidos
    WHERE pagamento_referencia = ?
    LIMIT 1`,
    [paymentReference]
  );

  const currentOrder = orders[0];

  if (!currentOrder) {
    throw new AppError(404, "Pedido nao encontrado para este pagamento.");
  }

  let nextPaymentStatus = currentOrder.pagamento_status;

  if (currentOrder.pagamento_status !== "aprovado") {
    if (normalizedStatus === "aprovado") {
      nextPaymentStatus = "aprovado";
    } else if (["cancelado", "rejeitado"].includes(normalizedStatus)) {
      nextPaymentStatus = normalizedStatus;
    } else {
      nextPaymentStatus = "pendente";
    }
  }

  let nextStatus = currentOrder.status;

  if (nextPaymentStatus === "aprovado") {
    if (currentOrder.status === "aguardando_pagamento") {
      nextStatus = "aberto";
    }
  } else if (["cancelado", "rejeitado"].includes(nextPaymentStatus)) {
    if (["aguardando_pagamento", "aberto"].includes(currentOrder.status)) {
      nextStatus = "cancelado";
    }
  } else if (
    nextPaymentStatus === "pendente" &&
    ["aguardando_pagamento", "aberto"].includes(currentOrder.status) &&
    currentOrder.pagamento_status !== "aprovado"
  ) {
    nextStatus = "aguardando_pagamento";
  }

  const [result] = await connection.query(
    `UPDATE pedidos
    SET pagamento_status = ?,
        pagamento_id_externo = COALESCE(?, pagamento_id_externo),
        status = ?,
        observacao = CASE
          WHEN ? IS NOT NULL AND ? <> '' THEN ?
          ELSE observacao
        END
    WHERE pagamento_referencia = ?`,
    [
      nextPaymentStatus,
      paymentId ? String(paymentId) : null,
      nextStatus,
      statusDetail,
      statusDetail,
      statusDetail,
      paymentReference
    ]
  );

  if (!result.affectedRows) {
    throw new AppError(404, "Pedido nao encontrado para este pagamento.");
  }
}

router.post(
  "/",
  createOrderRateLimit,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const connection = await pool.getConnection();

    try {
      const {
        id_cliente,
        id_estabelecimento,
        tipo_recebimento,
        forma_pagamento,
        observacao = null,
        itens
      } = req.validated.body;

      await connection.beginTransaction();

      const [menuItems] = await connection.query(
        `SELECT
          id_cardapio,
          nome,
          descricao,
          preco,
          preco_promocional,
          ativo
        FROM cardapio
        WHERE id_estabelecimento = ?
          AND id_cardapio IN (?)`,
        [id_estabelecimento, itens.map((item) => item.id_cardapio)]
      );

      if (menuItems.length !== itens.length) {
        throw new AppError(400, "Um ou mais itens do pedido sao invalidos.");
      }

      const menuMap = new Map(
        menuItems.map((item) => [item.id_cardapio, item])
      );

      let subtotal = 0;
      const normalizedItems = itens.map((item) => {
        const menuItem = menuMap.get(item.id_cardapio);

        if (!menuItem || !menuItem.ativo) {
          throw new AppError(400, "O cardapio possui item indisponivel.");
        }

        const unitPrice = Number(
          menuItem.preco_promocional || menuItem.preco
        );
        const itemSubtotal = unitPrice * item.quantidade;

        subtotal += itemSubtotal;

        return {
          id_cardapio: item.id_cardapio,
          nome: menuItem.nome,
          descricao: menuItem.descricao,
          quantidade: item.quantidade,
          preco_unitario: unitPrice,
          subtotal: itemSubtotal
        };
      });

      const [establishmentRows] = await connection.query(
        `SELECT
          id_estabelecimento,
          nome,
          possui_entrega,
          taxa_entrega,
          mercado_pago_access_token
        FROM estabelecimentos
        WHERE id_estabelecimento = ? AND ativo = 1
        LIMIT 1`,
        [id_estabelecimento]
      );

      const establishment = establishmentRows[0];

      if (!establishment) {
        throw new AppError(404, "Estabelecimento nao encontrado.");
      }

      const taxaEntrega =
        tipo_recebimento === "entrega" && establishment.possui_entrega
          ? Number(establishment.taxa_entrega || 0)
          : 0;
      const taxaServico = 0;
      const total = subtotal + taxaEntrega + taxaServico;
      const [clientRows] = await connection.query(
        `SELECT id_cliente, nome, email, telefone, endereco
        FROM clientes
        WHERE id_cliente = ? AND ativo = 1
        LIMIT 1`,
        [id_cliente]
      );

      const client = clientRows[0];

      if (!client) {
        throw new AppError(404, "Cliente nao encontrado.");
      }

      const [orderResult] = await connection.query(
        `INSERT INTO pedidos (
          id_cliente,
          id_estabelecimento,
          status,
          pagamento_status,
          pagamento_gateway,
          tipo_recebimento,
          forma_pagamento,
          subtotal,
          taxa_entrega,
          taxa_servico,
          total,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_cliente,
          id_estabelecimento,
          "aguardando_pagamento",
          "pendente",
          "mercado_pago",
          tipo_recebimento,
          forma_pagamento,
          subtotal,
          taxaEntrega,
          taxaServico,
          total,
          observacao
        ]
      );

      for (const item of normalizedItems) {
        await connection.query(
          `INSERT INTO pedido_item (
            id_pedido,
            id_cardapio,
            quantidade,
            preco_unitario,
            subtotal
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            orderResult.insertId,
            item.id_cardapio,
            item.quantidade,
            item.preco_unitario,
            item.subtotal
          ]
        );
      }

      const paymentReference = `eatgo_pedido_${orderResult.insertId}_${Date.now()}`;
      const notificationUrl = `${env.BACKEND_BASE_URL.replace(/\/$/, "")}/api/orders/payment-webhook?ref=${encodeURIComponent(paymentReference)}`;
      const preference = await createCheckoutPreference({
        accessToken: establishment.mercado_pago_access_token,
        orderId: orderResult.insertId,
        reference: paymentReference,
        notificationUrl,
        establishment,
        customer: client,
        items: normalizedItems,
        tipoRecebimento: tipo_recebimento,
        taxaEntrega,
        taxaServico
      });

      const checkoutUrl = preference.init_point || preference.sandbox_init_point;

      if (!checkoutUrl) {
        throw new AppError(502, "Nao foi possivel gerar o link de pagamento.");
      }

      await connection.query(
        `UPDATE pedidos
        SET pagamento_referencia = ?,
            pagamento_checkout_url = ?
        WHERE id_pedido = ?`,
        [paymentReference, checkoutUrl, orderResult.insertId]
      );

      await connection.commit();

      res.status(201).json({
        message: "Pedido criado e aguardando confirmacao do pagamento.",
        data: {
          id_pedido: orderResult.insertId,
          status: "aguardando_pagamento",
          pagamento_status: "pendente",
          pagamento_referencia: paymentReference,
          checkout_url: checkoutUrl
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.post(
  "/payment-return",
  validate(syncOrderPaymentSchema),
  asyncHandler(async (req, res) => {
    const {
      pagamento_referencia,
      payment_id,
      status,
      status_detail = null
    } = req.validated.body;

    const normalizedStatus = normalizeMercadoPagoStatus(status);

    await syncOrderPayment({
      paymentReference: pagamento_referencia,
      paymentId: payment_id,
      normalizedStatus,
      statusDetail: status_detail
    });

    res.json({
      message: "Retorno de pagamento sincronizado com sucesso.",
      data: {
        pagamento_referencia,
        pagamento_status: normalizedStatus
      }
    });
  })
);

router.all(
  "/payment-webhook",
  asyncHandler(async (req, res) => {
    const paymentReference = String(req.query.ref || req.body?.external_reference || "").trim();
    const eventType = String(req.query.type || req.body?.type || req.query.topic || req.body?.topic || "").trim().toLowerCase();
    const paymentId =
      req.body?.data?.id ||
      req.query["data.id"] ||
      req.query.id ||
      req.body?.id ||
      null;

    if (!paymentReference) {
      return res.status(202).json({ received: true, ignored: true });
    }

    if (eventType && eventType !== "payment") {
      return res.status(202).json({ received: true, ignored: true });
    }

    const [orders] = await pool.query(
      `SELECT
        p.pagamento_referencia,
        e.mercado_pago_access_token
      FROM pedidos p
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = p.id_estabelecimento
      WHERE p.pagamento_referencia = ?
      LIMIT 1`,
      [paymentReference]
    );

    const order = orders[0];

    if (!order || !order.mercado_pago_access_token || !paymentId) {
      return res.status(202).json({ received: true, ignored: true });
    }

    const payment = await fetchPaymentDetails({
      accessToken: order.mercado_pago_access_token,
      paymentId
    });

    const normalizedStatus = normalizeMercadoPagoStatus(payment.status);

    await syncOrderPayment({
      paymentReference,
      paymentId,
      normalizedStatus,
      statusDetail: payment.status_detail || null
    });

    res.status(200).json({ received: true });
  })
);

router.get(
  "/client/:id_cliente",
  validate(getClientOrdersSchema),
  asyncHandler(async (req, res) => {
    const { id_cliente } = req.validated.params;

    const [orders] = await pool.query(
      `SELECT
        p.id_pedido,
        p.status,
        p.pagamento_status,
        p.pagamento_gateway,
        p.tipo_recebimento,
        p.forma_pagamento,
        p.total,
        p.observacao,
        p.criado_em,
        p.atualizado_em,
        e.nome AS estabelecimento_nome
      FROM pedidos p
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = p.id_estabelecimento
      WHERE p.id_cliente = ?
      ORDER BY p.criado_em DESC`,
      [id_cliente]
    );

    res.json({ data: orders });
  })
);

router.patch(
  "/:id/cancel",
  validate(cancelClientOrderSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { id_cliente } = req.validated.body;

    const [orders] = await pool.query(
      `SELECT
        id_pedido,
        status,
        pagamento_status
      FROM pedidos
      WHERE id_pedido = ? AND id_cliente = ?
      LIMIT 1`,
      [id, id_cliente]
    );

    const order = orders[0];

    if (!order) {
      throw new AppError(404, "Pedido nao encontrado.");
    }

    if (["cancelado", "entregue", "saiu_para_entrega", "preparando"].includes(order.status)) {
      throw new AppError(400, "Este pedido nao pode mais ser cancelado pelo cliente.");
    }

    await pool.query(
      `UPDATE pedidos
      SET status = 'cancelado',
          pagamento_status = CASE
            WHEN pagamento_status = 'pendente' THEN 'cancelado'
            ELSE pagamento_status
          END,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id_pedido = ? AND id_cliente = ?`,
      [id, id_cliente]
    );

    res.json({ message: "Pedido cancelado com sucesso." });
  })
);

module.exports = router;
