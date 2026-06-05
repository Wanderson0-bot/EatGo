const { Router } = require("express");
const { query, pool } = require("../../../config/database");
const asyncHandler = require("../../../lib/async-handler");
const AppError = require("../../../lib/app-error");
const validate = require("../../../middlewares/validate");
const { createPaymentRefund } = require("../../../services/payment.service");
const {
  reviewCancellationSchema,
  updateOrderStatusSchema
} = require("../../../schemas/order.schema");

const router = Router();

router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const orders = await query(
      `SELECT
        p.id_pedido,
        p.id_cliente,
        c.nome AS cliente_nome,
        c.endereco AS cliente_endereco,
        p.status,
        p.pagamento_status,
        p.pagamento_id_externo,
        p.pagamento_gateway,
        p.tipo_recebimento,
        p.forma_pagamento,
        p.subtotal,
        p.taxa_entrega,
        p.taxa_servico,
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
        p.atualizado_em
      FROM pedidos p
      INNER JOIN clientes c
        ON c.id_cliente = p.id_cliente
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = p.id_estabelecimento
      WHERE p.id_estabelecimento = ?
      ORDER BY p.criado_em DESC`,
      [req.auth.id_estabelecimento]
    );

    res.json({ data: orders });
  })
);

router.patch(
  "/orders/:id/cancel-review",
  validate(reviewCancellationSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const {
      decisao,
      valor_reembolso = null,
      taxa = 0,
      analise_texto
    } = req.validated.body;

    const [orders] = await pool.query(
      `SELECT
        p.id_pedido,
        p.status,
        p.total,
        p.pagamento_status,
        p.pagamento_id_externo,
        p.cancelamento_status,
        e.mercado_pago_access_token
      FROM pedidos p
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = p.id_estabelecimento
      WHERE p.id_pedido = ? AND p.id_estabelecimento = ?
      LIMIT 1`,
      [id, req.auth.id_estabelecimento]
    );

    const order = orders[0];

    if (!order) {
      throw new AppError(404, "Pedido nao encontrado.");
    }

    if (order.cancelamento_status !== "em_analise") {
      throw new AppError(400, "Este pedido nao possui cancelamento pendente de analise.");
    }

    if (decisao === "negar") {
      await pool.query(
        `UPDATE pedidos
        SET cancelamento_status = 'negado',
            cancelamento_analisado_em = CURRENT_TIMESTAMP,
            cancelamento_taxa = ?,
            cancelamento_analise_texto = ?,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id_pedido = ? AND id_estabelecimento = ?`,
        [Number(taxa || 0), analise_texto, id, req.auth.id_estabelecimento]
      );

      res.json({ message: "Cancelamento negado com sucesso." });
      return;
    }

    const total = Number(order.total || 0);
    const refundAmount =
      decisao === "aprovar_total"
        ? total
        : Number(valor_reembolso != null ? valor_reembolso : 0);

    if (decisao === "aprovar_parcial" && (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount >= total)) {
      throw new AppError(400, "Informe um valor de reembolso parcial valido.");
    }

    if (order.pagamento_status === "aprovado" && !order.pagamento_id_externo) {
      throw new AppError(
        400,
        "Nao foi possivel localizar o pagamento externo para efetuar o reembolso."
      );
    }

    if (order.pagamento_status === "aprovado" && order.pagamento_id_externo) {
      await createPaymentRefund({
        accessToken: order.mercado_pago_access_token,
        paymentId: order.pagamento_id_externo,
        amount: refundAmount
      });
    }

    await pool.query(
      `UPDATE pedidos
      SET status = CASE
            WHEN ? = 'aprovar_total' THEN 'cancelado'
            ELSE status
          END,
          pagamento_status = CASE
            WHEN pagamento_status = 'aprovado' AND ? = 'aprovar_total' THEN 'cancelado'
            ELSE pagamento_status
          END,
          cancelamento_status = ?,
          cancelamento_analisado_em = CURRENT_TIMESTAMP,
          cancelamento_valor_reembolso = ?,
          cancelamento_taxa = ?,
          cancelamento_analise_texto = ?,
          pagamento_reembolsado_valor = ?,
          pagamento_reembolsado_em = CURRENT_TIMESTAMP,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id_pedido = ? AND id_estabelecimento = ?`,
      [
        decisao,
        decisao,
        decisao === "aprovar_total" ? "aprovado_total" : "aprovado_parcial",
        refundAmount,
        Number(taxa || 0),
        analise_texto,
        refundAmount,
        id,
        req.auth.id_estabelecimento
      ]
    );

    res.json({
      message:
        decisao === "aprovar_total"
          ? "Cancelamento aprovado com reembolso total."
          : "Cancelamento aprovado com reembolso parcial."
    });
  })
);

router.patch(
  "/orders/:id/status",
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { status } = req.validated.body;

    const orders = await query(
      `SELECT id_pedido, status, pagamento_status, cancelamento_status
      FROM pedidos
      WHERE id_pedido = ? AND id_estabelecimento = ?
      LIMIT 1`,
      [id, req.auth.id_estabelecimento]
    );

    if (!orders[0]) {
      throw new AppError(404, "Pedido nao encontrado.");
    }

    if (orders[0].pagamento_status !== "aprovado") {
      throw new AppError(400, "A loja so pode operar pedidos com pagamento aprovado.");
    }

    if (orders[0].status === "cancelado" || orders[0].status === "entregue") {
      throw new AppError(400, "Este pedido nao pode mais ter o status alterado.");
    }

    if (orders[0].cancelamento_status === "em_analise") {
      throw new AppError(400, "Resolva primeiro a solicitacao de cancelamento deste pedido.");
    }

    await query(
      `UPDATE pedidos
      SET status = ?
      WHERE id_pedido = ? AND id_estabelecimento = ?`,
      [status, id, req.auth.id_estabelecimento]
    );

    res.json({ message: "Status do pedido atualizado com sucesso." });
  })
);

module.exports = router;
