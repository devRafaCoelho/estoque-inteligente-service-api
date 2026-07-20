const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    logger.http?.("request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id || null,
    });
  });
  next();
}

module.exports = requestLogger;
