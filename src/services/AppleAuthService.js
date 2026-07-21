const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const AppError = require("../utils/AppError");
const env = require("../config/env");

const appleJwks = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
  cache: true,
  rateLimit: true,
});

function getAppleSigningKey(header, callback) {
  appleJwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    return callback(null, key.getPublicKey());
  });
}

function verifyAppleToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getAppleSigningKey,
      {
        algorithms: ["RS256"],
        audience: env.APPLE_CLIENT_ID,
        issuer: "https://appleid.apple.com",
      },
      (err, decoded) => {
        if (err) return reject(err);
        return resolve(decoded);
      },
    );
  });
}

const AppleAuthService = {
  async verifyIdToken(idToken, { fullName } = {}) {
    if (!env.APPLE_CLIENT_ID) {
      throw new AppError("Login com Apple não configurado no servidor", 503);
    }

    try {
      const payload = await verifyAppleToken(idToken);
      if (!payload?.sub) {
        throw new AppError("Token Apple inválido", 401);
      }

      const emailVerified =
        payload.email_verified === true || payload.email_verified === "true";

      return {
        provider: "apple",
        providerUserId: payload.sub,
        email: payload.email || null,
        emailVerified,
        name: fullName || null,
        avatarUrl: null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Token Apple inválido ou expirado", 401);
    }
  },
};

module.exports = AppleAuthService;
