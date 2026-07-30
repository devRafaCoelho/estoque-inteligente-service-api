const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const setRoutes = require("./routes");
const setupSwagger = require("./docs/setupSwagger");
const requestLogger = require("./middlewares/requestLogger");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

/** CORS_ORIGIN aceita uma origem ou várias separadas por vírgula. */
const corsOrigins = String(env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // requests sem Origin (curl, health, same-origin server-side)
      if (!origin) return callback(null, true);
      if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(requestLogger);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

setupSwagger(app);
setRoutes(app);

app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use(errorHandler);

module.exports = app;
