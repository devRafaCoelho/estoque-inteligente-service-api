const ShoppingListService = require("../services/ShoppingListService");

const ShoppingListController = {
  async getActive(req, res) {
    const list = await ShoppingListService.getActive(req.user.id);
    return res.status(200).json({ list });
  },

  async generate(req, res) {
    const list = await ShoppingListService.generate(req.user.id, req.body);
    return res.status(200).json({ list });
  },

  async addItem(req, res) {
    const result = await ShoppingListService.addItem(req.user.id, req.body);
    return res.status(201).json(result);
  },

  async updateItem(req, res) {
    const item = await ShoppingListService.updateItem(req.user.id, req.params.id, req.body);
    return res.status(200).json({ item });
  },

  async deleteItem(req, res) {
    const result = await ShoppingListService.deleteItem(req.user.id, req.params.id);
    return res.status(200).json(result);
  },

  async setViewMode(req, res) {
    const list = await ShoppingListService.setViewMode(req.user.id, req.body.viewMode);
    return res.status(200).json({ list });
  },
};

module.exports = ShoppingListController;
