// Endpoints de autenticação da área de gestão.
const { Router } = require("express");
const { query } = require("../../config/database");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const validate = require("../../middlewares/validate");
const { requireAuth } = require("../../middlewares/auth");
const env = require("../../config/env");
const {
  partnerLoginSchema,
  partnerRecoverPasswordSchema,
  partnerResetPasswordSchema
} = require("../../schemas/auth.schema");
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
const crypto = require("crypto");
const { sendRecoveryEmail } = require("../../services/email.service");


const router = Router();

router.post(
  "/partner/login",
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
  validate(partnerRecoverPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.validated.body;

    const users = await query(
      `SELECT id_usuario_estabelecimento
       FROM usuarios_estabelecimento
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = users[0];

    if (!user) {
      throw new AppError(404, "Conta nao encontrada.");
    }

    const token = crypto.randomBytes(32).toString("hex");

    const expires = new Date(Date.now() + 1000 * 60 * 60);

    await query(
      `UPDATE usuarios_estabelecimento
       SET reset_token = ?,
           reset_token_expira_em = ?
       WHERE id_usuario_estabelecimento = ?`,
      [token, expires, user.id_usuario_estabelecimento]
    );

    const recoveryLink =
      `${env.FRONTEND_BASE_URL.replace(/\/$/, "")}/reset.html?token=${encodeURIComponent(token)}`;

    await sendRecoveryEmail(email, recoveryLink);

    res.json({
      message: "Link de recuperacao enviado para o email."
    });
  })
);

router.post(
  "/partner/reset-password",
  validate(partnerResetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, senha } = req.validated.body;

    const users = await query(
      `SELECT
        id_usuario_estabelecimento,
        reset_token_expira_em
       FROM usuarios_estabelecimento
       WHERE reset_token = ?
       LIMIT 1`,
      [token]
    );

    const user = users[0];

    if (!user) {
      throw new AppError(400, "Token invalido.");
    }

    if (new Date(user.reset_token_expira_em) < new Date()) {
      throw new AppError(400, "Token expirado.");
    }

    const senhaHash = await hashPassword(senha);

    await query(
      `UPDATE usuarios_estabelecimento
       SET senha_hash = ?,
           reset_token = NULL,
           reset_token_expira_em = NULL
       WHERE id_usuario_estabelecimento = ?`,
      [senhaHash, user.id_usuario_estabelecimento]
    );

    res.json({
      message: "Senha redefinida com sucesso."
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
