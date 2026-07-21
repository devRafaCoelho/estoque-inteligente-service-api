const DashboardService = require("../services/DashboardService");

const DashboardController = {
  async getStats(req, res) {
    const result = await DashboardService.getStats(req.user.id);
    return res.status(200).json(result);
  },
};

module.exports = DashboardController;
