const FinanceService = require("../services/FinanceService");

const FinanceController = {
  async getSummary(req, res) {
    const result = await FinanceService.getSummary(req.user.id);
    return res.status(200).json(result);
  },

  async getByCategory(req, res) {
    const result = await FinanceService.getByCategory(req.user.id, {
      year: req.query.year,
      month: req.query.month,
    });
    return res.status(200).json(result);
  },

  async getSeries(req, res) {
    const year = Number(req.query.year) || new Date().getFullYear();
    const result = await FinanceService.getSeries(req.user.id, { year });
    return res.status(200).json(result);
  },

  async getTips(req, res) {
    const result = await FinanceService.getTips(req.user.id, {
      year: req.query.year,
      month: req.query.month,
    });
    return res.status(200).json(result);
  },
};

module.exports = FinanceController;
