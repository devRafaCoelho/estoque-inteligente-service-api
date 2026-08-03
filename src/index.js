require("dotenv").config();

const app = require("./app");
const env = require("./config/env");
const db = require("./config/db");
const logger = require("./utils/logger");
const GoogleAuthService = require("./services/GoogleAuthService");
const { ensureReferenceData } = require("./bootstrap/ensureReferenceData");
const { ensureSchemaMigrations } = require("./bootstrap/ensureSchemaMigrations");

const server = app.listen(env.PORT, () => {
  logger.info(`estoque-inteligente-api rodando na porta ${env.PORT}`);
});

async function warmUp() {
  try {
    await db.warmUp();
    await ensureSchemaMigrations();
    await ensureReferenceData();
  } catch (err) {
    logger.warn("Falha ao aquecer conexão com o PostgreSQL", { error: err.message });
  }
  await GoogleAuthService.warmUp();
}

warmUp().catch((err) => {
  logger.warn("Warm-up inicial incompleto", { error: err.message });
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { reason: String(reason) });
});

process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { message: err.message, stack: err.stack });
});

server.on("clientError", (err, socket) => {
  if (err.code === "ECONNRESET" || !socket.writable) return;
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

module.exports = server;
