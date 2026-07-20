const AuthService = require("../services/AuthService");

const AuthController = {
  async register(req, res) {
    const result = await AuthService.register(req.body);
    return res.status(201).json(result);
  },

  async login(req, res) {
    const result = await AuthService.login(req.body);
    return res.status(200).json(result);
  },

  async me(req, res) {
    const user = await AuthService.me(req.user.id);
    return res.status(200).json({ user });
  },
};

module.exports = AuthController;
