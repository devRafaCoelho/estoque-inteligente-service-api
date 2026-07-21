const { OAuth2Client } = require("google-auth-library");
const AppError = require("../utils/AppError");
const env = require("../config/env");

let client;

function getClient() {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError("Login com Google não configurado no servidor", 503);
  }
  if (!client) {
    client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return client;
}

const GoogleAuthService = {
  async verifyIdToken(idToken) {
    try {
      const ticket = await getClient().verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        throw new AppError("Token Google inválido", 401);
      }
      return {
        provider: "google",
        providerUserId: payload.sub,
        email: payload.email || null,
        emailVerified: Boolean(payload.email_verified),
        name: payload.name || null,
        avatarUrl: payload.picture || null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Token Google inválido ou expirado", 401);
    }
  },
};

module.exports = GoogleAuthService;
