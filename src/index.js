require("dotenv").config();

const app = require("./app");
const env = require("./config/env");
const logger = require("./utils/logger");

const server = app.listen(env.PORT, () => {
  logger.info(`estoque-inteligente-api rodando na porta ${env.PORT}`);
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { reason: String(reason) });
});

module.exports = server;
