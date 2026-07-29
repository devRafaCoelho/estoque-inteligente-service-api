const ShoppingListShareService = require("../services/ShoppingListShareService");

const ShoppingListShareController = {
  async createShare(req, res) {
    const result = await ShoppingListShareService.createShare(req.user.id);
    return res.status(201).json(result);
  },

  async revokeShare(req, res) {
    const result = await ShoppingListShareService.revokeShare(req.user.id, req.params.shareId);
    return res.status(200).json(result);
  },

  async listShares(req, res) {
    const result = await ShoppingListShareService.listShares(req.user.id);
    return res.status(200).json(result);
  },

  async getSharedList(req, res) {
    const list = await ShoppingListShareService.getSharedList(req.params.token);
    return res.status(200).json({ list });
  },
};

module.exports = ShoppingListShareController;
