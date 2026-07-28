const crypto = require("node:crypto");
const db = require("../config/db");
const AppError = require("../utils/AppError");
const UserRepository = require("../repositories/UserRepository");
const UserAuthIdentityRepository = require("../repositories/UserAuthIdentityRepository");
const PasswordResetTokenRepository = require("../repositories/PasswordResetTokenRepository");
const EmailService = require("./EmailService");
const env = require("../config/env");
const { hashPassword } = require("../helpers/hashPassword");
const { passwordResetEmail } = require("../mail/emailLayout");
const { buildDisplayName } = require("../helpers/personName");

const TOKEN_TTL_MINUTES = 45;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(token) {
  return `${env.APP_URL.replace(/\/$/, "")}/resetar-senha?token=${encodeURIComponent(token)}`;
}

const PasswordResetService = {
  async request(email) {
    const user = await UserRepository.findByEmail(String(email || "").toLowerCase());
    if (!user || user.status === "deleted") return { requested: true };

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await db.withTransaction(async (client) => {
      await PasswordResetTokenRepository.invalidateOpenTokens(user.id, client);
      await PasswordResetTokenRepository.create({ userId: user.id, tokenHash, expiresAt }, client);
    });

    const resetUrl = buildResetUrl(token);
    const mail = passwordResetEmail({
      firstName: user.first_name || buildDisplayName(user).split(/\s+/)[0],
      resetUrl,
      ttlMinutes: TOKEN_TTL_MINUTES,
    });
    await EmailService.send({
      to: user.email,
      ...mail,
    });

    return { requested: true };
  },

  async reset({ token, password }) {
    const tokenHash = hashToken(token);
    const tokenRow = await PasswordResetTokenRepository.findValidByHash(tokenHash);
    if (!tokenRow) throw new AppError("Link de redefinição inválido ou expirado", 400);

    const user = await UserRepository.findById(tokenRow.user_id);
    if (!user || user.status === "deleted") {
      throw new AppError("Conta não encontrada", 404);
    }

    const passwordHash = await hashPassword(password);
    await db.withTransaction(async (client) => {
      await UserRepository.updatePassword(user.id, passwordHash, client);
      await PasswordResetTokenRepository.markUsed(tokenRow.id, client);
      const identities = await UserAuthIdentityRepository.listByUserId(user.id, client);
      const hasLocal = identities.some((row) => row.provider === "local");
      if (!hasLocal) {
        await UserAuthIdentityRepository.create(
          {
            userId: user.id,
            provider: "local",
            providerUserId: user.id,
            email: user.email,
            emailVerified: false,
          },
          client,
        );
      }
    });

    return { reset: true };
  },
};

module.exports = PasswordResetService;
