const AppError = require("../utils/AppError");
const UserRepository = require("../repositories/UserRepository");
const UserAuthIdentityRepository = require("../repositories/UserAuthIdentityRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const PushSubscriptionRepository = require("../repositories/PushSubscriptionRepository");
const { hashPassword, comparePassword } = require("../helpers/hashPassword");
const { UserDto } = require("../dto/v1/userDto");
const { UserPreferencesDto } = require("../dto/v1/userPreferencesDto");

const UserService = {
  async updateMe(userId, fields) {
    const updated = await UserRepository.update(userId, fields);
    if (!updated) throw new AppError("Usuário não encontrado", 404);
    const OAuthService = require("./OAuthService");
    const authProviders = await OAuthService.listAuthProviders(userId, updated);
    return UserDto(updated, authProviders);
  },

  async getPreferences(userId) {
    let prefs = await UserPreferencesRepository.findByUser(userId);
    if (!prefs) {
      await UserPreferencesRepository.createDefaults(userId);
      prefs = await UserPreferencesRepository.findByUser(userId);
    }
    if (!prefs) throw new AppError("Preferências não encontradas", 404);
    const subscriptions = await PushSubscriptionRepository.countByUser(userId);
    if (Boolean(prefs.push_enabled) !== (subscriptions > 0)) {
      prefs = await UserPreferencesRepository.update(userId, {
        pushEnabled: subscriptions > 0,
      });
    }
    return UserPreferencesDto(prefs);
  },

  async updatePreferences(userId, fields) {
    await UserPreferencesRepository.createDefaults(userId);
    const updated = await UserPreferencesRepository.update(userId, fields);
    if (!updated) throw new AppError("Preferências não encontradas", 404);
    return UserPreferencesDto(updated);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await UserRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado", 404);

    if (user.password_hash) {
      const ok = await comparePassword(currentPassword || "", user.password_hash);
      if (!ok) throw new AppError("Senha atual incorreta", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await UserRepository.updatePassword(userId, passwordHash);

    const identities = await UserAuthIdentityRepository.listByUserId(userId);
    const hasLocal = identities.some((row) => row.provider === "local");
    if (!hasLocal) {
      await UserAuthIdentityRepository.create({
        userId,
        provider: "local",
        providerUserId: userId,
        email: user.email,
        emailVerified: false,
      });
    }

    return { updated: true };
  },

  async deleteAccount(userId) {
    // F3-4.4: owner com membros ativos não pode apagar a conta
    const HouseholdService = require("./HouseholdService");
    await HouseholdService.assertCanDeleteAccount(userId);

    await UserAuthIdentityRepository.deactivateByUserId(userId);
    await UserRepository.softDelete(userId);
    return { deleted: true };
  },
};

module.exports = UserService;
