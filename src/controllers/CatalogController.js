const CatalogService = require("../services/CatalogService");

const CatalogController = {
  async listCategories(_req, res) {
    const result = await CatalogService.listCategories();
    return res.status(200).json(result);
  },

  async listUnits(_req, res) {
    const result = await CatalogService.listUnits();
    return res.status(200).json(result);
  },

  async listStates(_req, res) {
    const result = await CatalogService.listStates();
    return res.status(200).json(result);
  },
};

module.exports = CatalogController;
