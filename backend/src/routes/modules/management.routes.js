// Endpoints protegidos usados no painel de gestão.
const { Router } = require("express");
const { query, pool } = require("../../config/database");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const validate = require("../../middlewares/validate");
const { requireAuth } = require("../../middlewares/auth");
const { updateEstablishmentSchema } = require("../../schemas/establishment.schema");
const {
  createMenuItemSchema,
  updateMenuItemSchema,
  menuItemParamsSchema
} = require("../../schemas/menu.schema");
const { updateOrderStatusSchema } = require("../../schemas/order.schema");

const router = Router();

router.use(requireAuth);

router.get(
  "/establishment",
  asyncHandler(async (req, res) => {
    const establishments = await query(
      `SELECT
        id_estabelecimento,
        nome,
        cnpj,
        email,
        telefone,
        endereco,
        categoria,
        horario_funcionamento,
        possui_entrega,
        taxa_entrega,
        descricao,
        cardapio_manual,
        cardapio_pdf_nome,
        CASE
          WHEN mercado_pago_access_token IS NULL OR mercado_pago_access_token = '' THEN 0
          ELSE 1
        END AS mercado_pago_configurado,
        ativo,
        criado_em,
        atualizado_em
      FROM estabelecimentos
      WHERE id_estabelecimento = ?
      LIMIT 1`,
      [req.auth.id_estabelecimento]
    );

    res.json({ data: establishments[0] || null });
  })
);

router.patch(
  "/establishment",
  validate(updateEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const updates = { ...req.validated.body };
    if (Object.prototype.hasOwnProperty.call(updates, "mercado_pago_access_token")) {
      updates.mercado_pago_access_token =
        updates.mercado_pago_access_token || null;
    }
    const entries = Object.entries(updates);
    const fields = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = entries.map(([, value]) =>
      typeof value === "boolean" ? Number(value) : value
    );

    await query(
      `UPDATE estabelecimentos
      SET ${fields}
      WHERE id_estabelecimento = ?`,
      [...values, req.auth.id_estabelecimento]
    );

    res.json({ message: "Estabelecimento atualizado com sucesso." });
  })
);

router.delete(
  "/establishment",
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE estabelecimentos
      SET ativo = 0
      WHERE id_estabelecimento = ?`,
      [req.auth.id_estabelecimento]
    );

    await query(
      `UPDATE usuarios_estabelecimento
      SET ativo = 0
      WHERE id_estabelecimento = ?`,
      [req.auth.id_estabelecimento]
    );

    res.json({ message: "Estabelecimento removido com sucesso." });
  })
);

router.get(
  "/menu-items",
  asyncHandler(async (req, res) => {
    const items = await query(
      `SELECT
        id_cardapio,
        nome,
        descricao,
        preco,
        preco_promocional,
        imagem,
        categoria,
        ativo,
        criado_em,
        atualizado_em
      FROM cardapio
      WHERE id_estabelecimento = ?
      ORDER BY atualizado_em DESC`,
      [req.auth.id_estabelecimento]
    );

    res.json({ data: items });
  })
);

router.post(
  "/menu-items",
  validate(createMenuItemSchema),
  asyncHandler(async (req, res) => {
    const {
      nome,
      descricao = null,
      preco,
      preco_promocional = null,
      imagem = null,
      categoria = null,
      ativo = true
    } = req.validated.body;

    const result = await query(
      `INSERT INTO cardapio (
        id_estabelecimento,
        nome,
        descricao,
        preco,
        preco_promocional,
        imagem,
        categoria,
        ativo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.auth.id_estabelecimento,
        nome,
        descricao,
        preco,
        preco_promocional,
        imagem,
        categoria,
        ativo ? 1 : 0
      ]
    );

    res.status(201).json({
      message: "Item de cardapio criado com sucesso.",
      id: result.insertId
    });
  })
);

router.patch(
  "/menu-items/:id",
  validate(updateMenuItemSchema),
  asyncHandler(async (req, res) => {
    const updates = req.validated.body;
    const { id } = req.validated.params;

    const existing = await query(
      `SELECT id_cardapio
      FROM cardapio
      WHERE id_cardapio = ? AND id_estabelecimento = ?
      LIMIT 1`,
      [id, req.auth.id_estabelecimento]
    );

    if (!existing[0]) {
      throw new AppError(404, "Item de cardapio nao encontrado.");
    }

    const entries = Object.entries(updates);
    const fields = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = entries.map(([, value]) =>
      typeof value === "boolean" ? Number(value) : value
    );

    await query(
      `UPDATE cardapio
      SET ${fields}
      WHERE id_cardapio = ? AND id_estabelecimento = ?`,
      [...values, id, req.auth.id_estabelecimento]
    );

    res.json({ message: "Item de cardapio atualizado com sucesso." });
  })
);

router.delete(
  "/menu-items/:id",
  validate(menuItemParamsSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;

    await query(
      `DELETE FROM cardapio
      WHERE id_cardapio = ? AND id_estabelecimento = ?`,
      [id, req.auth.id_estabelecimento]
    );

    res.json({ message: "Item de cardapio removido com sucesso." });
  })
);

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
        p.pagamento_gateway,
        p.tipo_recebimento,
        p.forma_pagamento,
        p.subtotal,
        p.taxa_entrega,
        p.taxa_servico,
        p.total,
        p.observacao,
        p.criado_em,
        p.atualizado_em
      FROM pedidos p
      INNER JOIN clientes c
        ON c.id_cliente = p.id_cliente
      WHERE p.id_estabelecimento = ?
      ORDER BY p.criado_em DESC`,
      [req.auth.id_estabelecimento]
    );

    res.json({ data: orders });
  })
);

router.patch(
  "/orders/:id/status",
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { status } = req.validated.body;

    const orders = await query(
      `SELECT id_pedido, status, pagamento_status
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
