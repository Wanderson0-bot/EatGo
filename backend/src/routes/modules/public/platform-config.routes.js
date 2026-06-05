const { Router } = require("express");
const { query } = require("../../../config/database");
const asyncHandler = require("../../../lib/async-handler");

const router = Router();

async function getNitrogoPlatformConfig() {
  const rows = await query(
    `SELECT valor_json
     FROM configuracoes_plataforma
     WHERE chave = 'nitrogo'
     LIMIT 1`
  );

  const rawValue = rows?.[0]?.valor_json;

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

router.get(
  "/platform-config",
  asyncHandler(async (req, res) => {
    const nitrogo = await getNitrogoPlatformConfig();

    res.json({
      data: {
        nitrogo: {
          enabled: Boolean(nitrogo?.enabled)
        }
      }
    });
  })
);

module.exports = router;
