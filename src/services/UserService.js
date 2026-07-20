const AppError = require("../utils/AppError");
const UserRepository = require("../repositories/UserRepository");
const { hashPassword, comparePassword } = require("../helpers/hashPassword");
const { UserDto } = require("../dto/v1/userDto");

const UserService = {
  async updateMe(userId, fields) {
    const updated = await UserRepository.update(userId, fields);
    if (!updated) throw new AppError("Usuário não encontrado", 404);
    const authProviders = updated.password_hash ? ["local"] : [];
    return UserDto(updated, authProviders);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await UserRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado", 404);

    // Se já existe senha, exige a atual para trocar
    if (user.password_hash) {
      const ok = await comparePassword(currentPassword || "", user.password_hash);
      if (!ok) throw new AppError("Senha atual incorreta", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await UserRepository.updatePassword(userId, passwordHash);
    return { updated: true };
  },

  async deleteAccount(userId) {
    await UserRepository.softDelete(userId);
    return { deleted: true };
  },
};

module.exports = UserService;
