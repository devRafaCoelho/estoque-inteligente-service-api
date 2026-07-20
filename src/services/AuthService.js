const db = require("../config/db");
const AppError = require("../utils/AppError");
const UserRepository = require("../repositories/UserRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const { hashPassword, comparePassword } = require("../helpers/hashPassword");
const { signToken } = require("../helpers/signToken");
const { UserDto } = require("../dto/v1/userDto");

const AuthService = {
  issueSession(user, { isNewUser = false, authProviders = ["local"] } = {}) {
    const token = signToken({ sub: user.id, email: user.email });
    return { token, user: UserDto(user, authProviders), isNewUser };
  },

  async register({ name, email, password, defaultState }) {
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw new AppError("E-mail já cadastrado", 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await db.withTransaction(async (client) => {
      const created = await UserRepository.create(
        { name, email, passwordHash, defaultState: defaultState || null },
        client,
      );
      await UserPreferencesRepository.createDefaults(created.id, client);
      return created;
    });

    return this.issueSession(user, { isNewUser: true });
  },

  async login({ email, password }) {
    const user = await UserRepository.findByEmail(email);
    if (!user || user.status === "deleted") {
      throw new AppError("Credenciais inválidas", 401);
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      throw new AppError("Credenciais inválidas", 401);
    }

    await UserRepository.touchLastLogin(user.id);
    return this.issueSession(user);
  },

  async me(userId) {
    const user = await UserRepository.findById(userId);
    if (!user || user.status === "deleted") {
      throw new AppError("Usuário não encontrado", 404);
    }
    const authProviders = user.password_hash ? ["local"] : [];
    return UserDto(user, authProviders);
  },
};

module.exports = AuthService;
