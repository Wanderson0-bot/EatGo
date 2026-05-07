// Endpoints de autenticação da área de gestão.
const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../../config/database");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const validate = require("../../middlewares/validate");
const { requireAuth } = require("../../middlewares/auth");
const { partnerLoginSchema, partnerRecoverPasswordSchema } = require("../../schemas/auth.schema");
const { hashPassword, verifyPassword } = require("../../services/password.service");
const { signAccessToken } = require("../../services/token.service");
const {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionIdFromRequest,
  SESSION_SCOPES,
  setSessionCookie
} = require("../../services/session.service");

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

function normalizeDocument(value) {
  return String(value || "").replace(/\D/g, "");
}

router.post(
  "/partner/login",
  loginRateLimit,
  validate(partnerLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, senha } = req.validated.body;

    const users = await query(
      `SELECT
        ue.id_usuario_estabelecimento,
        ue.id_estabelecimento,
        ue.nome,
        ue.email,
        ue.senha_hash,
        ue.papel,
        ue.ativo,
        e.nome AS estabelecimento_nome,
        e.ativo AS estabelecimento_ativo
      FROM usuarios_estabelecimento ue
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = ue.id_estabelecimento
      WHERE ue.email = ?
      LIMIT 1`,
      [email]
    );

    const user = users[0];

    if (!user || !user.ativo || !user.estabelecimento_ativo) {
      throw new AppError(401, "Credenciais invalidas.");
    }

    const passwordMatches = await verifyPassword(senha, user.senha_hash);

    if (!passwordMatches) {
      throw new AppError(401, "Credenciais invalidas.");
    }

    await query(
      `UPDATE usuarios_estabelecimento
      SET ultimo_login_em = CURRENT_TIMESTAMP
      WHERE id_usuario_estabelecimento = ?`,
      [user.id_usuario_estabelecimento]
    );

    const token = signAccessToken(user);
    const existingSessionId = getSessionIdFromRequest(req, SESSION_SCOPES.PARTNER);

    await deleteSession(existingSessionId, SESSION_SCOPES.PARTNER);

    const sessionId = await createSession({
      scope: SESSION_SCOPES.PARTNER,
      userId: user.id_usuario_estabelecimento
    });
    setSessionCookie(res, SESSION_SCOPES.PARTNER, sessionId);

    res.json({
      token,
      user: {
        id: user.id_usuario_estabelecimento,
        nome: user.nome,
        email: user.email,
        papel: user.papel,
        id_estabelecimento: user.id_estabelecimento,
        estabelecimento_nome: user.estabelecimento_nome
      }
    });
  })
);

router.post(
  "/partner/logout",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionIdFromRequest(req, SESSION_SCOPES.PARTNER);
    await deleteSession(sessionId, SESSION_SCOPES.PARTNER);
    clearSessionCookie(res, SESSION_SCOPES.PARTNER);

    res.json({
      message: "Sessao da gestao encerrada com sucesso."
    });
  })
);

router.post(
  "/partner/recover-password",
  loginRateLimit,
  validate(partnerRecoverPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email, cnpj, nova_senha } = req.validated.body;

    const users = await query(
      `SELECT
        ue.id_usuario_estabelecimento,
        ue.ativo,
        e.cnpj,
        e.ativo AS estabelecimento_ativo
      FROM usuarios_estabelecimento ue
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = ue.id_estabelecimento
      WHERE ue.email = ?
      LIMIT 1`,
      [email]
    );

    const user = users[0];

    if (!user || !user.ativo || !user.estabelecimento_ativo) {
      throw new AppError(404, "Nao foi encontrada uma conta ativa com esses dados.");
    }

    if (normalizeDocument(user.cnpj) !== normalizeDocument(cnpj)) {
      throw new AppError(400, "Os dados informados nao conferem com o estabelecimento.");
    }

    const senhaHash = await hashPassword(nova_senha);

    await query(
      `UPDATE usuarios_estabelecimento
      SET senha_hash = ?, atualizado_em = CURRENT_TIMESTAMP
      WHERE id_usuario_estabelecimento = ?`,
      [senhaHash, user.id_usuario_estabelecimento]
    );

    res.json({
      message: "Senha atualizada com sucesso. Voce ja pode entrar na area de gestao."
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.auth.id_usuario_estabelecimento,
        nome: req.auth.nome,
        email: req.auth.email,
        papel: req.auth.papel,
        id_estabelecimento: req.auth.id_estabelecimento,
        estabelecimento_nome: req.auth.estabelecimento_nome
      }
    });
  })
);

module.exports = router;
