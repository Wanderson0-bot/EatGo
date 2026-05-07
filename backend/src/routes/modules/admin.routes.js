const crypto = require("crypto");
const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { pool, query } = require("../../config/database");
const env = require("../../config/env");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const validate = require("../../middlewares/validate");
const { requirePlatformAdmin } = require("../../middlewares/auth");
const { adminLoginSchema } = require("../../schemas/auth.schema");
const { createAdminEstablishmentSchema } = require("../../schemas/establishment.schema");
const { hashPassword } = require("../../services/password.service");
const { signPlatformAdminToken } = require("../../services/token.service");
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

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

router.post(
  "/login",
  loginRateLimit,
  validate(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const senhaInformada = req.validated.body?.senha || "";
    const senhaConfigurada = env.ADMIN_PANEL_PASSWORD || "";

    if (senhaConfigurada && !safeEqualText(senhaInformada, senhaConfigurada)) {
      throw new AppError(401, "Senha administrativa invalida.");
    }

    const token = signPlatformAdminToken();
    const existingSessionId = getSessionIdFromRequest(req, SESSION_SCOPES.ADMIN);

    await deleteSession(existingSessionId, SESSION_SCOPES.ADMIN);

    const sessionId = await createSession({
      scope: SESSION_SCOPES.ADMIN,
      adminSubject: "admin-platform"
    });
    setSessionCookie(res, SESSION_SCOPES.ADMIN, sessionId);

    res.json({
      token,
      user: {
        nome: env.ADMIN_PANEL_USER,
        papel: "admin_platform"
      }
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const sessionId = getSessionIdFromRequest(req, SESSION_SCOPES.ADMIN);
    await deleteSession(sessionId, SESSION_SCOPES.ADMIN);
    clearSessionCookie(res, SESSION_SCOPES.ADMIN);

    res.json({
      message: "Sessao administrativa encerrada com sucesso."
    });
  })
);

router.get(
  "/overview",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const [summaryRows, recentOrders, topEstablishments, topClients] = await Promise.all([
      query(
        `SELECT
          (SELECT COUNT(*) FROM estabelecimentos) AS estabelecimentos_total,
          (SELECT COUNT(*) FROM estabelecimentos WHERE ativo = 1) AS estabelecimentos_ativos,
          (SELECT COUNT(*) FROM estabelecimentos WHERE possui_entrega = 1 AND ativo = 1) AS estabelecimentos_com_entrega,
          (SELECT COUNT(*) FROM clientes WHERE ativo = 1) AS clientes_total,
          (SELECT COUNT(*) FROM pedidos) AS pedidos_total,
          (SELECT COUNT(*) FROM pedidos WHERE status IN ('aberto', 'confirmado', 'preparando', 'saiu_para_entrega')) AS pedidos_em_andamento,
          (SELECT COUNT(*) FROM pedidos WHERE pagamento_status = 'aprovado') AS pagamentos_aprovados,
          (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE pagamento_status = 'aprovado') AS faturamento_aprovado`
      ),
      query(
        `SELECT
          p.id_pedido,
          p.status,
          p.pagamento_status,
          p.forma_pagamento,
          p.tipo_recebimento,
          p.total,
          p.criado_em,
          c.nome AS cliente_nome,
          e.nome AS estabelecimento_nome
        FROM pedidos p
        INNER JOIN clientes c
          ON c.id_cliente = p.id_cliente
        INNER JOIN estabelecimentos e
          ON e.id_estabelecimento = p.id_estabelecimento
        ORDER BY p.criado_em DESC
        LIMIT 10`
      ),
      query(
        `SELECT
          e.id_estabelecimento,
          e.nome,
          e.categoria,
          e.ativo,
          e.possui_entrega,
          COUNT(p.id_pedido) AS pedidos_total,
          COALESCE(SUM(CASE WHEN p.pagamento_status = 'aprovado' THEN p.total ELSE 0 END), 0) AS faturamento_aprovado
        FROM estabelecimentos e
        LEFT JOIN pedidos p
          ON p.id_estabelecimento = e.id_estabelecimento
        GROUP BY
          e.id_estabelecimento,
          e.nome,
          e.categoria,
          e.ativo,
          e.possui_entrega
        ORDER BY faturamento_aprovado DESC, pedidos_total DESC, e.nome ASC
        LIMIT 12`
      ),
      query(
        `SELECT
          c.id_cliente,
          c.nome,
          c.email,
          c.telefone,
          COUNT(p.id_pedido) AS pedidos_total,
          COALESCE(SUM(CASE WHEN p.pagamento_status = 'aprovado' THEN p.total ELSE 0 END), 0) AS total_gasto
        FROM clientes c
        LEFT JOIN pedidos p
          ON p.id_cliente = c.id_cliente
        GROUP BY
          c.id_cliente,
          c.nome,
          c.email,
          c.telefone
        ORDER BY total_gasto DESC, pedidos_total DESC, c.nome ASC
        LIMIT 5`
      )
    ]);

    res.json({
      data: {
        admin: {
          nome: env.ADMIN_PANEL_USER
        },
        summary: summaryRows[0] || {},
        recentOrders,
        topEstablishments,
        topClients
      }
    });
  })
);

router.delete(
  "/establishments/:id",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Verificar se o estabelecimento existe
    const [establishment] = await query(
      "SELECT id_estabelecimento, nome FROM estabelecimentos WHERE id_estabelecimento = ?",
      [id]
    );

    if (!establishment) {
      throw new AppError(404, "Estabelecimento não encontrado.");
    }

    // Desativar estabelecimento em vez de deletar fisicamente
    await query(
      "UPDATE estabelecimentos SET ativo = 0 WHERE id_estabelecimento = ?",
      [id]
    );

    // Desativar usuários associados
    await query(
      "UPDATE usuarios_estabelecimento SET ativo = 0 WHERE id_estabelecimento = ?",
      [id]
    );

    res.json({
      message: `Estabelecimento "${establishment.nome}" removido com sucesso.`
    });
  })
);

router.post(
  "/establishments",
  requirePlatformAdmin,
  validate(createAdminEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const {
      nome,
      cnpj,
      email,
      telefone,
      endereco,
      categoria,
      horario_funcionamento,
      mercado_pago_access_token = null,
      possui_entrega,
      taxa_entrega = null,
      descricao = null,
      responsavel_nome,
      senha_acesso
    } = req.validated.body;

    const [existingCNPJ] = await query(
      "SELECT id_estabelecimento FROM estabelecimentos WHERE cnpj = ? LIMIT 1",
      [cnpj]
    );

    if (existingCNPJ) {
      throw new AppError(409, "Ja existe um estabelecimento cadastrado com este CNPJ.");
    }

    const [existingEstablishmentEmail] = await query(
      "SELECT id_estabelecimento FROM estabelecimentos WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingEstablishmentEmail) {
      throw new AppError(409, "Ja existe um estabelecimento cadastrado com este email.");
    }

    const [existingUserEmail] = await query(
      "SELECT id_usuario_estabelecimento FROM usuarios_estabelecimento WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingUserEmail) {
      throw new AppError(409, "Ja existe um usuario de gestao cadastrado com este email.");
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [establishmentResult] = await connection.execute(
        `INSERT INTO estabelecimentos (
          nome,
          cnpj,
          email,
          telefone,
          endereco,
          categoria,
          horario_funcionamento,
          mercado_pago_access_token,
          possui_entrega,
          taxa_entrega,
          descricao,
          ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          nome,
          cnpj,
          email,
          telefone,
          endereco,
          categoria,
          horario_funcionamento,
          mercado_pago_access_token,
          possui_entrega ? 1 : 0,
          taxa_entrega,
          descricao
        ]
      );

      const senhaHash = await hashPassword(senha_acesso);

      await connection.execute(
        `INSERT INTO usuarios_estabelecimento (
          id_estabelecimento,
          nome,
          email,
          senha_hash,
          papel,
          ativo
        ) VALUES (?, ?, ?, ?, 'admin', 1)`,
        [
          establishmentResult.insertId,
          responsavel_nome,
          email,
          senhaHash
        ]
      );

      await connection.commit();

      res.status(201).json({
        message: `Estabelecimento "${nome}" cadastrado com sucesso.`,
        data: {
          id_estabelecimento: establishmentResult.insertId,
          email_gestao: email,
          responsavel_nome
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

module.exports = router;
