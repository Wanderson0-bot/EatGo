const { Router } = require("express");
const { query } = require("../../../config/database");
const asyncHandler = require("../../../lib/async-handler");
const validate = require("../../../middlewares/validate");
const { updateEstablishmentSchema } = require("../../../schemas/establishment.schema");

const router = Router();

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
        horario_abertura,
        horario_fechamento,
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

module.exports = router;
