// Middleware JWT para proteger as rotas da área de gestão.
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { query } = require("../config/database");
const AppError = require("../lib/app-error");
const asyncHandler = require("../lib/async-handler");
const { getSessionById, getSessionIdFromRequest, SESSION_SCOPES } = require("../services/session.service");

async function resolvePartnerFromCookie(req) {
  const sessionId = getSessionIdFromRequest(req, SESSION_SCOPES.PARTNER);
  const session = await getSessionById(sessionId, SESSION_SCOPES.PARTNER);

  if (!session?.id_usuario_estabelecimento) {
    return null;
  }

  const users = await query(
    `SELECT
      ue.id_usuario_estabelecimento,
      ue.id_estabelecimento,
      ue.nome,
      ue.email,
      ue.papel,
      ue.ativo,
      e.nome AS estabelecimento_nome,
      e.ativo AS estabelecimento_ativo
    FROM usuarios_estabelecimento ue
    INNER JOIN estabelecimentos e
      ON e.id_estabelecimento = ue.id_estabelecimento
    WHERE ue.id_usuario_estabelecimento = ?
    LIMIT 1`,
    [session.id_usuario_estabelecimento]
  );

  return users[0] || null;
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  let user = null;

  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7);
    let payload;

    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
      throw new AppError(401, "Token invalido ou expirado.");
    }

    const users = await query(
      `SELECT
        ue.id_usuario_estabelecimento,
        ue.id_estabelecimento,
        ue.nome,
        ue.email,
        ue.papel,
        ue.ativo,
        e.nome AS estabelecimento_nome,
        e.ativo AS estabelecimento_ativo
      FROM usuarios_estabelecimento ue
      INNER JOIN estabelecimentos e
        ON e.id_estabelecimento = ue.id_estabelecimento
      WHERE ue.id_usuario_estabelecimento = ?
      LIMIT 1`,
      [payload.sub]
    );

    user = users[0];
  } else {
    user = await resolvePartnerFromCookie(req);
  }

  if (!user || !user.ativo || !user.estabelecimento_ativo) {
    throw new AppError(401, "Usuario sem acesso ativo.");
  }

  req.auth = user;
  next();
});

const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7);
    let payload;

    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch (error) {
      throw new AppError(401, "Token invalido ou expirado.");
    }

    if (payload.role !== "admin_platform") {
      throw new AppError(403, "Acesso restrito ao administrador da plataforma.");
    }

    req.admin = {
      role: payload.role,
      subject: payload.sub
    };
    next();
    return;
  }

  const sessionId = getSessionIdFromRequest(req, SESSION_SCOPES.ADMIN);
  const session = await getSessionById(sessionId, SESSION_SCOPES.ADMIN);

  if (!session?.admin_subject) {
    throw new AppError(401, "Sessao administrativa ausente.");
  }

  req.admin = {
    role: "admin_platform",
    subject: session.admin_subject
  };
  next();
});

module.exports = {
  requireAuth,
  requirePlatformAdmin
};
