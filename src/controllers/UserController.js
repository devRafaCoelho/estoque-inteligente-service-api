const UserService = require("../services/UserService");

const UserController = {
  async updateMe(req, res) {
    const user = await UserService.updateMe(req.user.id, req.body);
    return res.status(200).json({ user });
  },

  async changePassword(req, res) {
    const result = await UserService.changePassword(req.user.id, req.body);
    return res.status(200).json(result);
  },

  async deleteAccount(req, res) {
    const result = await UserService.deleteAccount(req.user.id);
    return res.status(200).json(result);
  },
};

module.exports = UserController;
