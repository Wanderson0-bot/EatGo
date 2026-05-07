// Carrega e valida as variáveis de ambiente obrigatórias do backend.
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function getRequired(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3000),
  APP_ORIGIN: process.env.APP_ORIGIN || "http://127.0.0.1:5500",
  FRONTEND_BASE_URL:
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_ORIGIN ||
    "http://127.0.0.1:5500",
  BACKEND_BASE_URL:
    process.env.BACKEND_BASE_URL ||
    `http://127.0.0.1:${Number(process.env.PORT || 3000)}`,
  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_NAME: getRequired("DB_NAME"),
  DB_USER: getRequired("DB_USER"),
  DB_PASSWORD: process.env.DB_PASSWORD || "123456",
  JWT_SECRET: getRequired("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  ADMIN_PANEL_PASSWORD: process.env.ADMIN_PANEL_PASSWORD || "Eatgo@9864",
  ADMIN_PANEL_USER: process.env.ADMIN_PANEL_USER || "Administrador EatGo",
  COOKIE_SECURE: parseBoolean(
    process.env.COOKIE_SECURE,
    process.env.NODE_ENV === "production"
  ),
  COOKIE_SAME_SITE:
    process.env.COOKIE_SAME_SITE ||
    (process.env.NODE_ENV === "production" ? "None" : "Lax"),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || ""
};

module.exports = env;
