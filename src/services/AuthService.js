const db = require("../config/db");
const AppError = require("../utils/AppError");
const UserRepository = require("../repositories/UserRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const UserAuthIdentityRepository = require("../repositories/UserAuthIdentityRepository");
const { hashPassword, comparePassword } = require("../helpers/hashPassword");
const { signToken } = require("../helpers/signToken");
const { UserDto } = require("../dto/v1/userDto");

const AuthService = {
  issueSession(user, { isNewUser = false, authProviders = ["local"] } = {}) {
    const token = signToken({ sub: user.id, email: user.email });
    return { token, user: UserDto(user, authProviders), isNewUser };
  },

  async register({ firstName, lastName, name, email, password, defaultState }) {
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw new AppError("E-mail já cadastrado", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await db.withTransaction(async (client) => {
      const created = await UserRepository.create(
        {
          firstName: firstName || undefined,
          lastName: lastName || null,
          name,
          email,
          passwordHash,
          defaultState: defaultState || null,
        },
        client,
      );
      await UserPreferencesRepository.createDefaults(created.id, client);
      await UserAuthIdentityRepository.create(
        {
          userId: created.id,
          provider: "local",
          providerUserId: created.id,
          email: created.email,
          emailVerified: false,
        },
        client,
      );
      return created;
    });

    return this.issueSession(user, { isNewUser: true, authProviders: ["local"] });
  },

  async login({ email, password }) {
    const user = await UserRepository.findByEmail(email);
    if (!user || user.status === "deleted") {
      throw new AppError("Credenciais inválidas", 401);
    }

    if (!user.password_hash) {
      throw new AppError(
        "Esta conta usa login social. Entre com Google ou Apple, ou defina uma senha em Minha conta",
        401,
      );
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      throw new AppError("Credenciais inválidas", 401);
    }

    await UserRepository.touchLastLogin(user.id);
    const OAuthService = require("./OAuthService");
    const authProviders = await OAuthService.listAuthProviders(user.id, user);
    return this.issueSession(user, { authProviders });
  },

  async me(userId) {
    const user = await UserRepository.findById(userId);
    if (!user || user.status === "deleted") {
      throw new AppError("Usuário não encontrado", 404);
    }
    const OAuthService = require("./OAuthService");
    const authProviders = await OAuthService.listAuthProviders(user.id, user);
    return UserDto(user, authProviders);
  },
};

module.exports = AuthService;
