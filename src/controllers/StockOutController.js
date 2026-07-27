const StockOutService = require("../services/StockOutService");
const StockOutConfirmService = require("../services/StockOutConfirmService");

const StockOutController = {
  async list(req, res) {
    const stockOuts = await StockOutService.list(req.user.id, req.query);
    return res.status(200).json({ stockOuts });
  },

  async parseText(req, res) {
    const stockOut = await StockOutService.parseNaturalLanguage(req.user.id, req.body.text);
    return res.status(201).json({ stockOut });
  },

  async get(req, res) {
    const stockOut = await StockOutService.get(req.user.id, req.params.id);
    return res.status(200).json({ stockOut });
  },

  async update(req, res) {
    const stockOut = await StockOutService.update(req.user.id, req.params.id, req.body);
    return res.status(200).json({ stockOut });
  },

  async confirm(req, res) {
    const result = await StockOutConfirmService.confirm(req.user.id, req.params.id, req.body);
    return res.status(200).json(result);
  },

  async cancel(req, res) {
    const stockOut = await StockOutService.cancel(req.user.id, req.params.id);
    return res.status(200).json({ stockOut });
  },

  async clearDrafts(req, res) {
    const result = await StockOutService.clearDrafts(req.user.id);
    return res.status(200).json(result);
  },
};

module.exports = StockOutController;
