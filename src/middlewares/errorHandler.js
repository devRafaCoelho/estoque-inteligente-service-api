const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { details: err.details });
    }
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details || undefined,
    });
  }

  // Erros de constraint do PostgreSQL comuns
  if (err.code === "23505") {
    return res.status(409).json({ error: "Registro duplicado", details: err.detail });
  }

  logger.error("Erro não tratado", { message: err.message, stack: err.stack });
  return res.status(500).json({ error: "Erro interno do servidor" });
}

module.exports = errorHandler;
