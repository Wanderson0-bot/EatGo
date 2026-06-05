const { Router } = require("express");
const { query } = require("../../../config/database");
const asyncHandler = require("../../../lib/async-handler");
const AppError = require("../../../lib/app-error");
const validate = require("../../../middlewares/validate");
const {
  createMenuItemSchema,
  updateMenuItemSchema,
  menuItemParamsSchema
} = require("../../../schemas/menu.schema");

const router = Router();

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

module.exports = router;
