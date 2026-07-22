const FinanceService = require("../services/FinanceService");

const FinanceController = {
  async getSummary(req, res) {
    const result = await FinanceService.getSummary(req.user.id);
    return res.status(200).json(result);
  },

  async getSeries(req, res) {
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 1), 26);
    const result = await FinanceService.getSeries(req.user.id, { weeks });
    return res.status(200).json(result);
  },

  async getTips(req, res) {
    const result = await FinanceService.getTips(req.user.id);
    return res.status(200).json(result);
  },
};

module.exports = FinanceController;
