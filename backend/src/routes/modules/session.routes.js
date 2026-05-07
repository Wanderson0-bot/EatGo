const { Router } = require("express");
const asyncHandler = require("../../lib/async-handler");
const { ensurePublicSession, updateSessionData } = require("../../services/session.service");

const router = Router();

function sanitizePublicState(state) {
  const source = state && typeof state === "object" ? state : {};

  return {
    carrinho: Array.isArray(source.carrinho) ? source.carrinho : [],
    perfil: source.perfil && typeof source.perfil === "object" ? source.perfil : {},
    clienteId: source.clienteId ? String(source.clienteId) : null,
    clienteCadastroConcluido: Boolean(source.clienteCadastroConcluido),
    acessibilidade:
      source.acessibilidade && typeof source.acessibilidade === "object"
        ? source.acessibilidade
        : {},
    cadastroRascunho:
      source.cadastroRascunho && typeof source.cadastroRascunho === "object"
        ? source.cadastroRascunho
        : null,
    restaurantesCadastrados: Array.isArray(source.restaurantesCadastrados)
      ? source.restaurantesCadastrados
      : [],
    ultimoPagamentoSincronizado: source.ultimoPagamentoSincronizado
      ? String(source.ultimoPagamentoSincronizado)
      : null
  };
}

router.get(
  "/public-state",
  asyncHandler(async (req, res) => {
    const session = await ensurePublicSession(req, res);

    res.json({
      data: sanitizePublicState(session?.data || {})
    });
  })
);

router.put(
  "/public-state",
  asyncHandler(async (req, res) => {
    const session = await ensurePublicSession(req, res);
    const nextState = sanitizePublicState(req.body?.state);

    await updateSessionData(session.id_sessao, nextState);

    res.json({
      message: "Estado publico sincronizado com sucesso.",
      data: nextState
    });
  })
);

module.exports = router;
