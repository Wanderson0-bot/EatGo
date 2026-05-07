// Middlewares finais para rotas inexistentes e erros centralizados.
const AppError = require("../lib/app-error");

function notFoundHandler(req, res, next) {
  next(new AppError(404, "Rota nao encontrada."));
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const payload = {
    error: error.message || "Erro interno do servidor."
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
