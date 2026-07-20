const AppError = require("../utils/AppError");
const { verifyToken } = require("../helpers/signToken");

function validateAuthentication(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError("Token de autenticação ausente", 401));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (_err) {
    return next(new AppError("Token inválido ou expirado", 401));
  }
}

module.exports = validateAuthentication;
