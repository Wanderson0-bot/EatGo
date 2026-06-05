const crypto = require("crypto");
const { Router } = require("express");
const { pool, query } = require("../../config/database");
const env = require("../../config/env");
const asyncHandler = require("../../lib/async-handler");
const AppError = require("../../lib/app-error");
const validate = require("../../middlewares/validate");
const { requirePlatformAdmin } = require("../../middlewares/auth");
const { adminLoginSchema } = require("../../schemas/auth.schema");
const {
  createAdminEstablishmentSchema,
  updateAdminEstablishmentSchema
} = require("../../schemas/establishment.schema");
const { updateNitrogoPlatformSchema } = require("../../schemas/platform.schema");
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

async function getNitrogoPlatformConfig(connection = { query }) {
  const rows = await connection.query(
    `SELECT valor_json
    FROM configuracoes_plataforma
    WHERE chave = 'nitrogo'
    LIMIT 1`
  );
  const record = Array.isArray(rows) ? rows[0] : rows?.[0];
  const rawValue = record?.valor_json;

  if (!rawValue) {
    return { enabled: false };
  }

  if (typeof rawValue === "string") {
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      return { enabled: false };
    }
  }

  return rawValue;
}

function safeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function mapAdminEstablishmentError(error) {
  if (!error || error instanceof AppError) {
    return error;
  }

  if (error.code === "ER_DUP_ENTRY") {
    return new AppError(
      409,
      "Ja existe um registro com os dados informados para este estabelecimento."
    );
  }

  if (error.code === "ER_NO_SUCH_TABLE") {
    return new AppError(
      500,
      "O banco de dados esta incompleto. Verifique se o schema da plataforma foi aplicado."
    );
  }

  if (error.code === "ER_BAD_FIELD_ERROR") {
    return new AppError(
      500,
      "O banco de dados esta desatualizado para o cadastro de estabelecimentos."
    );
  }

  if (error.code === "ER_DATA_TOO_LONG") {
    return new AppError(
      400,
      "Um dos campos informados excede o tamanho permitido."
    );
  }

  return error;
}

router.post(
  "/login",
  validate(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const senhaInformada = req.validated.body?.senha || "";
    const senhaConfigurada = env.ADMIN_PANEL_PASSWORD || "";

    if (senhaConfigurada && !safeEqualText(senhaInformada, senhaConfigurada)) {
      throw new AppError(401, "Senha administrativa invalida.");
    }

    const token = signPlatformAdminToken();
    const existingSessionId = getSessionIdFromRequest(req, SESSION_SCOPES.ADMIN);
    let sessionWarning = null;

    try {
      await deleteSession(existingSessionId, SESSION_SCOPES.ADMIN);

      const sessionId = await createSession({
        scope: SESSION_SCOPES.ADMIN,
        adminSubject: "admin-platform"
      });
      setSessionCookie(res, SESSION_SCOPES.ADMIN, sessionId);
    } catch (error) {
      sessionWarning = "Falha ao persistir a sessao administrativa no banco.";
      console.error("Falha ao criar sessao administrativa:", error);
    }

    res.json({
      token,
      user: {
        nome: env.ADMIN_PANEL_USER,
        papel: "admin_platform"
      },
      sessionWarning
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
    const [summaryRows, recentOrders, topEstablishments, topClients, monthlyPerformance, nitrogoConfig] = await Promise.all([
      query(
        `SELECT
          (SELECT COUNT(*) FROM estabelecimentos) AS estabelecimentos_total,
          (SELECT COUNT(*) FROM estabelecimentos WHERE ativo = 1) AS estabelecimentos_ativos,
          (SELECT COUNT(*) FROM estabelecimentos WHERE possui_entrega = 1 AND ativo = 1) AS estabelecimentos_com_entrega,
          (SELECT COUNT(*) FROM clientes WHERE ativo = 1) AS clientes_total,
          (SELECT COUNT(*) FROM pedidos) AS pedidos_total,
          (SELECT COUNT(*) FROM pedidos WHERE status IN ('pago', 'confirmado', 'preparando', 'saiu_para_entrega')) AS pedidos_em_andamento,
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
          e.nitrogo_ativo,
          e.nitrogo_cupom_valor,
          e.nitrogo_frete_gratis,
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
          e.possui_entrega,
          e.nitrogo_ativo,
          e.nitrogo_cupom_valor,
          e.nitrogo_frete_gratis
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
      ),
      query(
        `SELECT
          e.id_estabelecimento,
          e.nome,
          e.categoria,
          e.ativo,
          e.nitrogo_ativo,
          e.nitrogo_cupom_valor,
          e.nitrogo_frete_gratis,
          COUNT(
            CASE
              WHEN p.criado_em >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
               AND p.criado_em < DATE_ADD(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 1 MONTH)
              THEN 1
            END
          ) AS pedidos_mes_atual,
          COALESCE(SUM(
            CASE
              WHEN p.criado_em >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
               AND p.criado_em < DATE_ADD(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 1 MONTH)
               AND p.pagamento_status = 'aprovado'
              THEN p.total
              ELSE 0
            END
          ), 0) AS faturamento_mes_atual,
          COUNT(
            CASE
              WHEN p.criado_em >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH), '%Y-%m-01')
               AND p.criado_em < DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
              THEN 1
            END
          ) AS pedidos_mes_anterior,
          COALESCE(SUM(
            CASE
              WHEN p.criado_em >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH), '%Y-%m-01')
               AND p.criado_em < DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
               AND p.pagamento_status = 'aprovado'
              THEN p.total
              ELSE 0
            END
          ), 0) AS faturamento_mes_anterior,
          MAX(p.criado_em) AS ultimo_pedido_em
        FROM estabelecimentos e
        LEFT JOIN pedidos p
          ON p.id_estabelecimento = e.id_estabelecimento
        GROUP BY
          e.id_estabelecimento,
          e.nome,
          e.categoria,
          e.ativo,
          e.nitrogo_ativo,
          e.nitrogo_cupom_valor,
          e.nitrogo_frete_gratis
        ORDER BY faturamento_mes_atual ASC, pedidos_mes_atual ASC, e.nome ASC`
      ),
      getNitrogoPlatformConfig()
    ]);

    res.json({
      data: {
        admin: {
          nome: env.ADMIN_PANEL_USER
        },
        platformConfig: {
          nitrogo: {
            enabled: Boolean(nitrogoConfig?.enabled)
          }
        },
        summary: summaryRows[0] || {},
        recentOrders,
        topEstablishments,
        topClients,
        monthlyPerformance
      }
    });
  })
);

router.patch(
  "/platform-config/nitrogo",
  requirePlatformAdmin,
  validate(updateNitrogoPlatformSchema),
  asyncHandler(async (req, res) => {
    const { enabled } = req.validated.body;

    await query(
      `INSERT INTO configuracoes_plataforma (chave, valor_json)
      VALUES ('nitrogo', ?)
      ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)`,
      [JSON.stringify({ enabled: Boolean(enabled) })]
    );

    res.json({
      message: enabled
        ? "NitroGo ativado na plataforma."
        : "NitroGo desativado na plataforma.",
      data: {
        enabled: Boolean(enabled)
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

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute(
        "DELETE FROM carrinho WHERE id_estabelecimento = ?",
        [id]
      );

      await connection.execute(
        "DELETE FROM pedidos WHERE id_estabelecimento = ?",
        [id]
      );

      await connection.execute(
        "DELETE FROM estabelecimentos WHERE id_estabelecimento = ?",
        [id]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.json({
      message: `Estabelecimento "${establishment.nome}" removido com sucesso.`
    });
  })
);

router.get(
  "/establishments/:id",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [establishmentRows, managementUsers, menuItems] = await Promise.all([
      query(
        `SELECT
          id_estabelecimento,
          nome,
          cnpj,
          logo_url,
          email,
          telefone,
          endereco,
          categoria,
          horario_abertura,
          horario_fechamento,
          mercado_pago_access_token,
          possui_entrega,
          taxa_entrega,
          descricao,
          nitrogo_ativo,
          nitrogo_cupom_valor,
          nitrogo_frete_gratis,
          ativo
        FROM estabelecimentos
        WHERE id_estabelecimento = ?
        LIMIT 1`,
        [id]
      ),
      query(
        `SELECT
          id_usuario_estabelecimento,
          nome,
          email,
          papel,
          ativo
        FROM usuarios_estabelecimento
        WHERE id_estabelecimento = ?
        ORDER BY id_usuario_estabelecimento ASC`,
        [id]
      ),
      query(
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
        WHERE id_estabelecimento = ?
        ORDER BY id_cardapio ASC`,
        [id]
      )
    ]);

    const establishment = establishmentRows[0];

    if (!establishment) {
      throw new AppError(404, "Estabelecimento nao encontrado.");
    }

    res.json({
      data: {
        ...establishment,
        management_user: managementUsers[0] || null,
        menu_items: menuItems
      }
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
      horario_abertura,
      horario_fechamento,
      logo_url = null,
      mercado_pago_access_token = null,
      possui_entrega,
      taxa_entrega = null,
      descricao = null,
      nitrogo_ativo = false,
      nitrogo_cupom_valor = null,
      nitrogo_frete_gratis = false,
      menu_items = [],
      responsavel_nome,
      senha_acesso
    } = req.validated.body;
    const normalizedCnpj = cnpj || null;

    if (normalizedCnpj) {
      const [existingCNPJ] = await query(
        "SELECT id_estabelecimento FROM estabelecimentos WHERE cnpj = ? LIMIT 1",
        [normalizedCnpj]
      );

      if (existingCNPJ) {
        throw new AppError(409, "Ja existe um estabelecimento cadastrado com este CNPJ.");
      }
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
          horario_abertura,
          horario_fechamento,
          logo_url,
          mercado_pago_access_token,
          possui_entrega,
          taxa_entrega,
          descricao,
          nitrogo_ativo,
          nitrogo_cupom_valor,
          nitrogo_frete_gratis,
          ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          nome,
          normalizedCnpj,
          email,
          telefone,
          endereco,
          categoria,
          horario_abertura,
          horario_fechamento,
          logo_url,
          mercado_pago_access_token,
          possui_entrega ? 1 : 0,
          taxa_entrega,
          descricao,
          nitrogo_ativo ? 1 : 0,
          nitrogo_ativo ? nitrogo_cupom_valor : null,
          nitrogo_ativo && nitrogo_frete_gratis ? 1 : 0
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

      if (Array.isArray(menu_items) && menu_items.length) {
        for (const item of menu_items) {
          await connection.execute(
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
              establishmentResult.insertId,
              item.nome,
              item.descricao || null,
              item.preco,
              item.preco_promocional || null,
              item.imagem || null,
              item.categoria || null,
              item.ativo === false ? 0 : 1
            ]
          );
        }
      }

      await connection.commit();

      res.status(201).json({
        message: `Estabelecimento "${nome}" cadastrado com sucesso.`,
        data: {
          id_estabelecimento: establishmentResult.insertId,
          email_gestao: email,
          responsavel_nome,
          itens_cardapio: Array.isArray(menu_items) ? menu_items.length : 0
        }
      });
    } catch (error) {
      await connection.rollback();
      throw mapAdminEstablishmentError(error);
    } finally {
      connection.release();
    }
  })
);

router.patch(
  "/establishments/:id",
  requirePlatformAdmin,
  validate(updateAdminEstablishmentSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const updates = { ...req.validated.body };

    const [existingEstablishments] = await Promise.all([
      query(
        `SELECT id_estabelecimento, email, cnpj
        FROM estabelecimentos
        WHERE id_estabelecimento = ?
        LIMIT 1`,
        [id]
      )
    ]);

    const existingEstablishment = existingEstablishments[0];

    if (!existingEstablishment) {
      throw new AppError(404, "Estabelecimento nao encontrado.");
    }

    const managementUsers = await query(
      `SELECT id_usuario_estabelecimento, email
      FROM usuarios_estabelecimento
      WHERE id_estabelecimento = ?
      ORDER BY id_usuario_estabelecimento ASC`,
      [id]
    );

    const primaryUser = managementUsers[0] || null;

    if (updates.cnpj) {
      const duplicatedCnpj = await query(
        `SELECT id_estabelecimento
        FROM estabelecimentos
        WHERE cnpj = ? AND id_estabelecimento <> ?
        LIMIT 1`,
        [updates.cnpj, id]
      );

      if (duplicatedCnpj[0]) {
        throw new AppError(409, "Ja existe um estabelecimento cadastrado com este CNPJ.");
      }
    }

    if (updates.email) {
      const duplicatedEstablishmentEmail = await query(
        `SELECT id_estabelecimento
        FROM estabelecimentos
        WHERE email = ? AND id_estabelecimento <> ?
        LIMIT 1`,
        [updates.email, id]
      );

      if (duplicatedEstablishmentEmail[0]) {
        throw new AppError(409, "Ja existe um estabelecimento cadastrado com este email.");
      }

      if (primaryUser) {
        const duplicatedUserEmail = await query(
          `SELECT id_usuario_estabelecimento
          FROM usuarios_estabelecimento
          WHERE email = ? AND id_usuario_estabelecimento <> ?
          LIMIT 1`,
          [updates.email, primaryUser.id_usuario_estabelecimento]
        );

        if (duplicatedUserEmail[0]) {
          throw new AppError(409, "Ja existe um usuario de gestao cadastrado com este email.");
        }
      }
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        responsavel_nome,
        senha_acesso,
        menu_items,
        ...establishmentUpdatesRaw
      } = updates;

      const establishmentEntries = Object.entries(establishmentUpdatesRaw).map(([key, value]) => [
        key,
        typeof value === "boolean" ? Number(value) : value
      ]);

      if (establishmentEntries.length) {
        const fields = establishmentEntries.map(([key]) => `${key} = ?`).join(", ");
        const values = establishmentEntries.map(([, value]) => value);

        await connection.execute(
          `UPDATE estabelecimentos
          SET ${fields}
          WHERE id_estabelecimento = ?`,
          [...values, id]
        );
      }

      if (primaryUser && (responsavel_nome || updates.email || senha_acesso)) {
        const userEntries = [];

        if (responsavel_nome) {
          userEntries.push(["nome", responsavel_nome]);
        }

        if (updates.email) {
          userEntries.push(["email", updates.email]);
        }

        if (senha_acesso) {
          userEntries.push(["senha_hash", await hashPassword(senha_acesso)]);
        }

        if (userEntries.length) {
          const userFields = userEntries.map(([key]) => `${key} = ?`).join(", ");
          const userValues = userEntries.map(([, value]) => value);

          await connection.execute(
            `UPDATE usuarios_estabelecimento
            SET ${userFields}
            WHERE id_usuario_estabelecimento = ?`,
            [...userValues, primaryUser.id_usuario_estabelecimento]
          );
        }
      }

      if (Array.isArray(menu_items)) {
        await connection.execute(
          "DELETE FROM cardapio WHERE id_estabelecimento = ?",
          [id]
        );

        for (const item of menu_items) {
          await connection.execute(
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
              id,
              item.nome,
              item.descricao || null,
              item.preco,
              item.preco_promocional || null,
              item.imagem || null,
              item.categoria || null,
              item.ativo === false ? 0 : 1
            ]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw mapAdminEstablishmentError(error);
    } finally {
      connection.release();
    }

    res.json({
      message: "Estabelecimento atualizado com sucesso."
    });
  })
);

module.exports = router;
