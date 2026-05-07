// Endpoints públicos consumidos pelo marketplace.
const { Router } = require("express");
const { query } = require("../../config/database");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const validate = require("../../middlewares/validate");
const { createClientSchema, getClientSchema } = require("../../schemas/client.schema");

const router = Router();

router.post(
  "/establishments",
  asyncHandler(async (req, res) => {
    throw new AppError(
      403,
      "Cadastro de estabelecimentos disponivel apenas no painel administrativo."
    );
  })
);

router.get(
  "/establishments",
  asyncHandler(async (req, res) => {
    const establishments = await query(
      `SELECT
        id_estabelecimento,
        nome,
        email,
        telefone,
        endereco,
        categoria,
        horario_funcionamento,
        possui_entrega,
        taxa_entrega,
        descricao
      FROM estabelecimentos
      WHERE ativo = 1
      ORDER BY nome ASC`
    );

    res.json({ data: establishments });
  })
);

router.get(
  "/establishments/:id",
  asyncHandler(async (req, res) => {
    const establishments = await query(
      `SELECT
        id_estabelecimento,
        nome,
        email,
        telefone,
        endereco,
        categoria,
        horario_funcionamento,
        possui_entrega,
        taxa_entrega,
        descricao
      FROM estabelecimentos
      WHERE id_estabelecimento = ? AND ativo = 1
      LIMIT 1`,
      [req.params.id]
    );

    const establishment = establishments[0];

    if (!establishment) {
      throw new AppError(404, "Estabelecimento nao encontrado.");
    }

    res.json({ data: establishment });
  })
);

router.get(
  "/establishments/:id/menu",
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
        ativo
      FROM cardapio
      WHERE id_estabelecimento = ? AND ativo = 1
      ORDER BY nome ASC`,
      [req.params.id]
    );

    res.json({ data: items });
  })
);

router.get(
  "/clients",
  validate(getClientSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.validated.query;
    const clients = await query(
      `SELECT
        id_cliente,
        nome,
        email,
        telefone,
        endereco
      FROM clientes
      WHERE email = ? AND ativo = 1
      LIMIT 1`,
      [email]
    );

    const client = clients[0];
    if (!client) {
      throw new AppError(404, "Cliente nao encontrado.");
    }

    res.json({ data: client });
  })
);

router.post(
  "/clients",
  validate(createClientSchema),
  asyncHandler(async (req, res) => {
    const { nome, email, telefone, endereco } = req.validated.body;

    const existing = await query(
      `SELECT id_cliente
      FROM clientes
      WHERE email = ? AND ativo = 1
      LIMIT 1`,
      [email]
    );

    if (existing[0]) {
      await query(
        `UPDATE clientes
        SET nome = ?, telefone = ?, endereco = ?, atualizado_em = CURRENT_TIMESTAMP
        WHERE id_cliente = ?`,
        [nome, telefone, endereco, existing[0].id_cliente]
      );

      const [client] = await query(
        `SELECT id_cliente, nome, email, telefone, endereco
        FROM clientes
        WHERE id_cliente = ?
        LIMIT 1`,
        [existing[0].id_cliente]
      );

      return res.status(200).json({ data: client });
    }

    const result = await query(
      `INSERT INTO clientes (nome, email, telefone, endereco)
      VALUES (?, ?, ?, ?)`,
      [nome, email, telefone, endereco]
    );

    res.status(201).json({
      data: {
        id_cliente: result.insertId,
        nome,
        email,
        telefone,
        endereco,
      },
    });
  })
);

module.exports = router;
