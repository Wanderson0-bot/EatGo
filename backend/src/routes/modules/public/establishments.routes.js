const { Router } = require("express");
const { query } = require("../../../config/database");
const asyncHandler = require("../../../lib/async-handler");
const AppError = require("../../../lib/app-error");

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
        logo_url,
        email,
        telefone,
        endereco,
        categoria,
        horario_abertura,
        horario_fechamento,
        possui_entrega,
        taxa_entrega,
        descricao,
        nitrogo_ativo,
        nitrogo_cupom_valor,
        nitrogo_frete_gratis
      FROM estabelecimentos
      WHERE ativo = 1
      ORDER BY nome ASC`
    );

    res.json({
      data: establishments
    });
  })
);

router.get(
  "/establishments/:id",
  asyncHandler(async (req, res) => {
    const establishments = await query(
      `SELECT
        id_estabelecimento,
        nome,
        logo_url,
        email,
        telefone,
        endereco,
        categoria,
        horario_abertura,
        horario_fechamento,
        possui_entrega,
        taxa_entrega,
        descricao,
        nitrogo_ativo,
        nitrogo_cupom_valor,
        nitrogo_frete_gratis
      FROM estabelecimentos
      WHERE id_estabelecimento = ? AND ativo = 1
      LIMIT 1`,
      [req.params.id]
    );

    const establishment = establishments[0];

    if (!establishment) {
      throw new AppError(404, "Estabelecimento nao encontrado.");
    }

    res.json({
      data: establishment
    });
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

    res.json({
      data: items
    });
  })
);

module.exports = router;
