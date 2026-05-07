const crypto = require("crypto");
const { query } = require("../config/database");
const env = require("../config/env");

const SESSION_SCOPES = {
  PUBLIC: "public",
  PARTNER: "partner",
  ADMIN: "admin"
};

const COOKIE_NAMES = {
  public: "eatgo_public_session",
  partner: "eatgo_partner_session",
  admin: "eatgo_admin_session"
};

function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function appendCookieHeader(res, value) {
  const current = res.getHeader("Set-Cookie");

  if (!current) {
    res.setHeader("Set-Cookie", value);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, value]);
    return;
  }

  res.setHeader("Set-Cookie", [current, value]);
}

function buildCookieAttributes(maxAge = null) {
  const attributes = [
    "Path=/",
    "HttpOnly",
    `SameSite=${env.COOKIE_SAME_SITE}`
  ];

  if (env.COOKIE_SECURE) {
    attributes.push("Secure");
  }

  if (env.COOKIE_DOMAIN) {
    attributes.push(`Domain=${env.COOKIE_DOMAIN}`);
  }

  if (maxAge != null) {
    attributes.push(`Max-Age=${maxAge}`);
  }

  return attributes.join("; ");
}

function setSessionCookie(res, scope, sessionId) {
  const cookieName = COOKIE_NAMES[scope];
  if (!cookieName) {
    return;
  }

  appendCookieHeader(
    res,
    `${cookieName}=${encodeURIComponent(sessionId)}; ${buildCookieAttributes()}`
  );
}

function clearSessionCookie(res, scope) {
  const cookieName = COOKIE_NAMES[scope];
  if (!cookieName) {
    return;
  }

  appendCookieHeader(
    res,
    `${cookieName}=; ${buildCookieAttributes(0)}`
  );
}

function getSessionIdFromRequest(req, scope) {
  const cookieName = COOKIE_NAMES[scope];
  const cookies = parseCookies(req.headers.cookie);
  return cookies[cookieName] || null;
}

async function createSession({ scope, sessionId = generateSessionId(), data = null, userId = null, adminSubject = null }) {
  await query(
    `INSERT INTO sessoes_aplicacao (
      id_sessao,
      escopo,
      id_usuario_estabelecimento,
      admin_subject,
      dados_json
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      sessionId,
      scope,
      userId,
      adminSubject,
      data ? JSON.stringify(data) : null
    ]
  );

  return sessionId;
}

async function getSessionById(sessionId, scope = null) {
  if (!sessionId) {
    return null;
  }

  const params = scope ? [sessionId, scope] : [sessionId];
  const scopeFilter = scope ? "AND escopo = ?" : "";
  const sessions = await query(
    `SELECT
      id_sessao,
      escopo,
      id_usuario_estabelecimento,
      admin_subject,
      dados_json,
      criado_em,
      atualizado_em
    FROM sessoes_aplicacao
    WHERE id_sessao = ?
      ${scopeFilter}
    LIMIT 1`,
    params
  );

  const session = sessions[0];

  if (!session) {
    return null;
  }

  let parsedData = null;
  if (session.dados_json) {
    try {
      parsedData = JSON.parse(session.dados_json);
    } catch (error) {
      parsedData = null;
    }
  }

  return {
    ...session,
    data: parsedData
  };
}

async function updateSessionData(sessionId, data) {
  await query(
    `UPDATE sessoes_aplicacao
    SET dados_json = ?,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE id_sessao = ?`,
    [data ? JSON.stringify(data) : null, sessionId]
  );
}

async function deleteSession(sessionId, scope = null) {
  if (!sessionId) {
    return;
  }

  if (scope) {
    await query(
      "DELETE FROM sessoes_aplicacao WHERE id_sessao = ? AND escopo = ?",
      [sessionId, scope]
    );
    return;
  }

  await query("DELETE FROM sessoes_aplicacao WHERE id_sessao = ?", [sessionId]);
}

async function ensurePublicSession(req, res) {
  let sessionId = getSessionIdFromRequest(req, SESSION_SCOPES.PUBLIC);
  let session = await getSessionById(sessionId, SESSION_SCOPES.PUBLIC);

  if (!session) {
    sessionId = await createSession({
      scope: SESSION_SCOPES.PUBLIC,
      data: {}
    });
    setSessionCookie(res, SESSION_SCOPES.PUBLIC, sessionId);
    session = await getSessionById(sessionId, SESSION_SCOPES.PUBLIC);
  }

  return session;
}

module.exports = {
  COOKIE_NAMES,
  SESSION_SCOPES,
  clearSessionCookie,
  createSession,
  deleteSession,
  ensurePublicSession,
  getSessionById,
  getSessionIdFromRequest,
  setSessionCookie,
  updateSessionData
};
