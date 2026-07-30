const db = require("../config/db");
const AppError = require("../utils/AppError");
const UserRepository = require("../repositories/UserRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const UserAuthIdentityRepository = require("../repositories/UserAuthIdentityRepository");
const { UserDto } = require("../dto/v1/userDto");
const AuthService = require("./AuthService");
const GoogleAuthService = require("./GoogleAuthService");
const AppleAuthService = require("./AppleAuthService");
const EmailService = require("./EmailService");
const { welcomeEmail } = require("../mail/emailLayout");
const { buildDisplayName } = require("../helpers/personName");

function resolveDisplayName({ name, email, provider }) {
  if (name && String(name).trim()) return String(name).trim().slice(0, 150);
  if (email) return email.split("@")[0].slice(0, 150);
  return provider === "apple" ? "Usuário Apple" : "Usuário";
}

function resolveEmail({ email, provider, providerUserId }) {
  if (email) return email.toLowerCase();
  return `${provider}_${providerUserId}@users.estoque-inteligente.local`.toLowerCase();
}

async function buildAuthProviders(userId, userRow, client = db) {
  const providers = await UserAuthIdentityRepository.listProvidersByUserId(userId, client);
  const unique = new Set(providers);
  if (userRow?.password_hash) unique.add("local");
  return Array.from(unique);
}

const OAuthService = {
  listAuthProviders: buildAuthProviders,

  async findOrCreateUser(profile) {
    const {
      provider,
      providerUserId,
      email,
      emailVerified = false,
      name,
      avatarUrl = null,
    } = profile;

    const existingIdentity = await UserAuthIdentityRepository.findByProvider(
      provider,
      providerUserId,
    );

    if (existingIdentity) {
      const user = await UserRepository.findById(existingIdentity.user_id);
      if (!user || user.status === "deleted") {
        throw new AppError("Conta associada a este login está indisponível", 403);
      }
      await UserAuthIdentityRepository.touchLastUsed(existingIdentity.id);
      await UserRepository.touchLastLogin(user.id);
      const authProviders = await buildAuthProviders(user.id, user);
      return AuthService.issueSession(user, { isNewUser: false, authProviders });
    }

    const normalizedEmail = resolveEmail({ email, provider, providerUserId });
    const displayName = resolveDisplayName({ name, email: normalizedEmail, provider });

    const { user, isNewUser, authProviders } = await db.withTransaction(async (client) => {
      let userRow = email
        ? await UserRepository.findByEmail(normalizedEmail, client)
        : null;

      if (userRow && userRow.status === "deleted") {
        throw new AppError("Conta associada a este e-mail está encerrada", 403);
      }

      let created = false;
      if (!userRow) {
        userRow = await UserRepository.create(
          {
            name: displayName,
            email: normalizedEmail,
            passwordHash: null,
            avatarUrl,
          },
          client,
        );
        await UserPreferencesRepository.createDefaults(userRow.id, client);
        created = true;
      } else if (!userRow.avatar_url && avatarUrl) {
        userRow = await UserRepository.update(userRow.id, { avatarUrl }, client);
      }

      await UserAuthIdentityRepository.create(
        {
          userId: userRow.id,
          provider,
          providerUserId,
          email: email || normalizedEmail,
          emailVerified,
        },
        client,
      );

      await UserRepository.touchLastLogin(userRow.id, client);
      const authProviders = await buildAuthProviders(userRow.id, userRow, client);

      return { user: userRow, isNewUser: created, authProviders };
    });

    if (isNewUser) {
      const provider = authProviders.includes("google") ? "google" : "apple";
      const mail = welcomeEmail({
        firstName: user.first_name || buildDisplayName(user).split(/\s+/)[0],
        provider,
      });
      await EmailService.sendSafe({
        to: user.email,
        ...mail,
      });
    }

    return AuthService.issueSession(user, { isNewUser, authProviders });
  },

  async linkProvider(userId, profile) {
    const { provider, providerUserId, email, emailVerified = false, avatarUrl } = profile;

    const user = await UserRepository.findById(userId);
    if (!user || user.status === "deleted") {
      throw new AppError("Usuário não encontrado", 404);
    }

    const existing = await UserAuthIdentityRepository.findByProvider(provider, providerUserId);
    if (existing && existing.user_id !== userId) {
      throw new AppError("Esta conta social já está vinculada a outro usuário", 409);
    }
    if (existing && existing.user_id === userId) {
      await UserAuthIdentityRepository.touchLastUsed(existing.id);
      const authProviders = await buildAuthProviders(userId, user);
      return { user: UserDto(user, authProviders), linked: false };
    }

    await UserAuthIdentityRepository.create({
      userId,
      provider,
      providerUserId,
      email: email || user.email,
      emailVerified,
    });

    let refreshed = user;
    if (!user.avatar_url && avatarUrl) {
      refreshed = await UserRepository.update(userId, { avatarUrl });
    }

    const authProviders = await buildAuthProviders(userId, refreshed);
    return { user: UserDto(refreshed, authProviders), linked: true };
  },

  async loginWithGoogle(idToken) {
    const profile = await GoogleAuthService.verifyIdToken(idToken);
    return this.findOrCreateUser(profile);
  },

  async loginWithApple(idToken, fullName) {
    const profile = await AppleAuthService.verifyIdToken(idToken, { fullName });
    return this.findOrCreateUser(profile);
  },

  async linkGoogle(userId, idToken) {
    const profile = await GoogleAuthService.verifyIdToken(idToken);
    return this.linkProvider(userId, profile);
  },

  async linkApple(userId, idToken, fullName) {
    const profile = await AppleAuthService.verifyIdToken(idToken, { fullName });
    return this.linkProvider(userId, profile);
  },
};

module.exports = OAuthService;
