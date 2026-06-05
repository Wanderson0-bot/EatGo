// Endpoint público responsável por criar pedidos no marketplace.
const { Router } = require("express");
const { pool } = require("../../config/database");
const env = require("../../config/env");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const {
  createCheckoutPreference,
  createPaymentRefund,
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
      nextStatus = "pago";
    }
  } else if (["cancelado", "rejeitado"].includes(nextPaymentStatus)) {
    if (["aguardando_pagamento", "pago"].includes(currentOrder.status)) {
      nextStatus = "cancelado";
    }
  } else if (
    nextPaymentStatus === "pendente" &&
    ["aguardando_pagamento", "pago"].includes(currentOrder.status) &&
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

async function getOrderItems(connection, orderIds) {
  if (!orderIds.length) {
    return [];
  }

  const [items] = await connection.query(
    `SELECT
      pi.id_pedido,
      pi.id_cardapio,
      c.nome,
      c.descricao,
      pi.quantidade,
      pi.preco_unitario,
      pi.subtotal
    FROM pedido_item pi
    INNER JOIN cardapio c
      ON c.id_cardapio = pi.id_cardapio
    WHERE pi.id_pedido IN (?)`,
    [orderIds]
  );

  return items;
}

router.post(
  "/",
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
        nitrogo_utilizado = false,
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
          mercado_pago_access_token,
          nitrogo_ativo,
          nitrogo_cupom_valor,
          nitrogo_frete_gratis
        FROM estabelecimentos
        WHERE id_estabelecimento = ? AND ativo = 1
        LIMIT 1`,
        [id_estabelecimento]
      );

      const establishment = establishmentRows[0];

      if (!establishment) {
        throw new AppError(404, "Estabelecimento nao encontrado.");
      }

      const taxaEntregaBase =
        tipo_recebimento === "entrega" && establishment.possui_entrega
          ? Number(establishment.taxa_entrega || 0)
          : 0;
      const nitrogoCupomAplicado =
        Boolean(nitrogo_utilizado) && Number(establishment.nitrogo_ativo) === 1
          ? Number(establishment.nitrogo_cupom_valor || 0)
          : 0;
      const nitrogoFreteGratisAplicado =
        Boolean(nitrogo_utilizado) &&
        Number(establishment.nitrogo_ativo) === 1 &&
        tipo_recebimento === "entrega" &&
        Number(establishment.nitrogo_frete_gratis) === 1;
      const taxaEntrega = nitrogoFreteGratisAplicado ? 0 : taxaEntregaBase;
      const desconto = Math.min(
        subtotal + taxaEntrega,
        Math.max(nitrogoCupomAplicado, 0)
      );
      const taxaServico = 0;
      const total = Math.max(subtotal + taxaEntrega + taxaServico - desconto, 0);
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
          desconto,
          nitrogo_cupom_aplicado,
          nitrogo_frete_gratis_aplicado,
          taxa_entrega,
          taxa_servico,
          total,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_cliente,
          id_estabelecimento,
          "aguardando_pagamento",
          "pendente",
          "mercado_pago",
          tipo_recebimento,
          forma_pagamento,
          subtotal,
          desconto,
          nitrogoCupomAplicado > 0 ? 1 : 0,
          nitrogoFreteGratisAplicado ? 1 : 0,
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
        desconto,
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
        p.desconto,
        p.nitrogo_cupom_aplicado,
        p.nitrogo_frete_gratis_aplicado,
        p.total,
        p.observacao,
        p.cancelamento_status,
        p.cancelamento_motivo,
        p.cancelamento_solicitado_em,
        p.cancelamento_analisado_em,
        p.cancelamento_valor_reembolso,
        p.cancelamento_taxa,
        p.cancelamento_analise_texto,
        p.pagamento_reembolsado_valor,
        p.pagamento_reembolsado_em,
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

    const items = await getOrderItems(pool, orders.map((order) => order.id_pedido));
    const itemsByOrderId = new Map();

    items.forEach((item) => {
      if (!itemsByOrderId.has(item.id_pedido)) {
        itemsByOrderId.set(item.id_pedido, []);
      }

      itemsByOrderId.get(item.id_pedido).push(item);
    });

    res.json({
      data: orders.map((order) => ({
        ...order,
        itens: itemsByOrderId.get(order.id_pedido) || []
      }))
    });
  })
);

router.patch(
  "/:id/cancel",
  validate(cancelClientOrderSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { id_cliente, motivo } = req.validated.body;

    const [orders] = await pool.query(
      `SELECT
        p.id_pedido,
        p.id_estabelecimento,
        p.status,
        p.pagamento_status,
        p.pagamento_id_externo,
        p.total,
        p.cancelamento_status,
        e.mercado_pago_access_token
      FROM pedidos p
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = p.id_estabelecimento
      WHERE p.id_pedido = ? AND p.id_cliente = ?
      LIMIT 1`,
      [id, id_cliente]
    );

    const order = orders[0];

    if (!order) {
      throw new AppError(404, "Pedido nao encontrado.");
    }

    if (order.status === "cancelado") {
      throw new AppError(400, "Este pedido ja foi cancelado.");
    }

    if (order.cancelamento_status && order.cancelamento_status !== "nenhum") {
      throw new AppError(400, "Ja existe uma solicitacao de cancelamento para este pedido.");
    }

    if (["pago", "confirmado"].includes(order.status)) {
      if (order.pagamento_status === "aprovado" && !order.pagamento_id_externo) {
        throw new AppError(
          400,
          "Nao foi possivel iniciar o reembolso automatico deste pagamento. Contate o suporte."
        );
      }

      if (order.pagamento_status === "aprovado" && order.pagamento_id_externo) {
        await createPaymentRefund({
          accessToken: order.mercado_pago_access_token,
          paymentId: order.pagamento_id_externo
        });
      }

      await pool.query(
        `UPDATE pedidos
        SET status = 'cancelado',
            cancelamento_status = 'aprovado_total',
            cancelamento_motivo = ?,
            cancelamento_solicitado_em = CURRENT_TIMESTAMP,
            cancelamento_analisado_em = CURRENT_TIMESTAMP,
            cancelamento_valor_reembolso = ?,
            cancelamento_taxa = 0,
            cancelamento_analise_texto = 'Cancelamento automatico antes do preparo.',
            pagamento_reembolsado_valor = ?,
            pagamento_reembolsado_em = CURRENT_TIMESTAMP,
            pagamento_status = CASE
              WHEN pagamento_status = 'aprovado' THEN 'cancelado'
              ELSE pagamento_status
            END,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id_pedido = ? AND id_cliente = ?`,
        [motivo, Number(order.total || 0), Number(order.total || 0), id, id_cliente]
      );

      res.json({
        message: "Pedido cancelado com reembolso total antes do preparo.",
        data: {
          status: "cancelado",
          cancelamento_status: "aprovado_total",
          pagamento_reembolsado_valor: Number(order.total || 0)
        }
      });
      return;
    }

    if (order.status === "preparando") {
      await pool.query(
        `UPDATE pedidos
        SET cancelamento_status = 'em_analise',
            cancelamento_motivo = ?,
            cancelamento_solicitado_em = CURRENT_TIMESTAMP,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id_pedido = ? AND id_cliente = ?`,
        [motivo, id, id_cliente]
      );

      res.json({
        message: "Seu pedido esta em preparo. O cancelamento foi enviado para analise do estabelecimento.",
        data: {
          status: order.status,
          cancelamento_status: "em_analise"
        }
      });
      return;
    }

    if (order.status === "saiu_para_entrega") {
      throw new AppError(
        400,
        "Este pedido ja saiu para entrega. O cancelamento esta bloqueado ou pode ter taxa, geralmente sem reembolso."
      );
    }

    if (order.status === "entregue") {
      throw new AppError(400, "Pedidos entregues nao podem ser cancelados.");
    }

    throw new AppError(400, "Este pedido nao pode ser cancelado neste momento.");
  })
);

module.exports = router;
