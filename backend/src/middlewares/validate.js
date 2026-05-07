// Middleware genérico de validação usando schemas zod.
const AppError = require("../lib/app-error");

function validate(schema) {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      return next(
        new AppError(
          400,
          "Dados invalidos.",
          result.error.flatten()
        )
      );
    }

    req.validated = result.data;
    next();
  };
}

module.exports = validate;
