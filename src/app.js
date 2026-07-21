const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const setRoutes = require("./routes");
const setupSwagger = require("./docs/setupSwagger");
const requestLogger = require("./middlewares/requestLogger");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

setupSwagger(app);
setRoutes(app);

app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use(errorHandler);

module.exports = app;
