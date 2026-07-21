const AuthService = require("../services/AuthService");
const OAuthService = require("../services/OAuthService");

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

  async google(req, res) {
    const result = await OAuthService.loginWithGoogle(req.body.idToken);
    return res.status(200).json(result);
  },

  async apple(req, res) {
    const result = await OAuthService.loginWithApple(req.body.idToken, req.body.fullName || null);
    return res.status(200).json(result);
  },

  async linkGoogle(req, res) {
    const result = await OAuthService.linkGoogle(req.user.id, req.body.idToken);
    return res.status(200).json(result);
  },

  async linkApple(req, res) {
    const result = await OAuthService.linkApple(
      req.user.id,
      req.body.idToken,
      req.body.fullName || null,
    );
    return res.status(200).json(result);
  },
};

module.exports = AuthController;
