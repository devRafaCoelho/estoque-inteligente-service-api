const ProductRepository = require("../repositories/ProductRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const {
  MIN_OUTS_FOR_INTERVAL,
  groupOutMovements,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  buildProductEstimate,
} = require("../utils/consumptionEstimate");

const ConsumptionEstimateService = {
  MIN_OUTS_FOR_INTERVAL,
  groupOutMovements,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  buildProductEstimate,

  /**
   * Estima consumo de todos os produtos ativos do usuário.
   * @returns {Promise<object[]>}
   */
  async listEstimates(userId, { now = new Date() } = {}) {
    const [products, outRows] = await Promise.all([
      ProductRepository.list(userId, { active: true }),
      StockMovementRepository.listOutMovements(userId),
    ]);
    const byProduct = groupOutMovements(outRows);

    return products.map((product) =>
      buildProductEstimate(product, byProduct.get(product.id) || [], now),
    );
  },

  /**
   * Candidatos “atrasados”: têm estoque, ciclo esperado e passaram da janela sem baixa.
   * @returns {Promise<object[]>}
   */
  async listOverdueCandidates(userId, { now = new Date() } = {}) {
    const estimates = await this.listEstimates(userId, { now });
    return estimates
      .filter((item) => item.isOverdue)
      .sort(
        (a, b) =>
          (b.daysSinceLastOut || 0) - (a.daysSinceLastOut || 0) ||
          a.name.localeCompare(b.name),
      );
  },
};

module.exports = ConsumptionEstimateService;
