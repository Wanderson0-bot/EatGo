const { Router } = require("express");
const { query } = require("../../../config/database");
const asyncHandler = require("../../../lib/async-handler");
const AppError = require("../../../lib/app-error");
const validate = require("../../../middlewares/validate");
const {
  createClientSchema,
  getClientSchema
} = require("../../../schemas/client.schema");

const router = Router();

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

    res.json({
      data: client
    });
  })
);

router.post(
  "/clients",
  validate(createClientSchema),
  asyncHandler(async (req, res) => {
    const {
      nome,
      email,
      telefone,
      endereco
    } = req.validated.body;

    const existingClients = await query(
      `SELECT id_cliente
       FROM clientes
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (existingClients.length) {
      throw new AppError(
        400,
        "Este email ja esta cadastrado."
      );
    }

    const result = await query(
      `INSERT INTO clientes (
        nome,
        email,
        telefone,
        endereco,
        ativo
      )
      VALUES (?, ?, ?, ?, ?)`,
      [
        nome,
        email,
        telefone,
        endereco,
        1
      ]
    );

    res.status(201).json({
      data: {
        id_cliente: result.insertId,
        nome,
        email,
        telefone,
        endereco
      }
    });
  })
);

router.put(
  "/clients/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const {
      nome,
      telefone,
      endereco
    } = req.body;

    const existingClients = await query(
      `SELECT id_cliente
       FROM clientes
       WHERE id_cliente = ?
       LIMIT 1`,
      [id]
    );

    if (!existingClients.length) {
      throw new AppError(
        404,
        "Cliente nao encontrado."
      );
    }

    await query(
      `UPDATE clientes
       SET
        nome = ?,
        telefone = ?,
        endereco = ?
       WHERE id_cliente = ?`,
      [
        nome,
        telefone,
        endereco,
        id
      ]
    );

    res.json({
      success: true,
      message: "Cliente atualizado com sucesso."
    });
  })
);

module.exports = router;
