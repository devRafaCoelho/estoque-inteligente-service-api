const AppError = require("../utils/AppError");
const ProductRepository = require("../repositories/ProductRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const {
  MIN_OUTS_FOR_INTERVAL,
  MIN_OUTS_FOR_STABLE,
  groupOutMovements,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  buildProductEstimate,
  computePersistedConsumptionStats,
} = require("../utils/consumptionEstimate");

const ConsumptionEstimateService = {
  MIN_OUTS_FOR_INTERVAL,
  MIN_OUTS_FOR_STABLE,
  groupOutMovements,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  buildProductEstimate,
  computePersistedConsumptionStats,

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
   * Estimativa de um produto (reutilizável por monitor, chat e financeiro).
   */
  async estimateForProduct(userId, productId, { now = new Date(), client } = {}) {
    const product = await ProductRepository.findById(userId, productId, client);
    if (!product) {
      throw new AppError("Produto não encontrado", 404);
    }

    const movements = await StockMovementRepository.listByProduct(
      userId,
      productId,
      100,
      client,
    );
    const outs = movements
      .filter((m) => m.type === "out")
      .map((m) => ({
        quantity: Number(m.quantity) || 0,
        at: new Date(m.created_at),
      }))
      .sort((a, b) => a.at - b.at);

    return buildProductEstimate(product, outs, now);
  },

  /**
   * Persiste avg_weekly_usage / consumption_cycle_days quando há histórico estável.
   * Sem inventar valores: só grava se ≥ MIN_OUTS_FOR_STABLE baixas.
   */
  async refreshProductConsumptionStats(userId, productId, client) {
    const movements = await StockMovementRepository.listByProduct(
      userId,
      productId,
      100,
      client,
    );
    const outs = movements
      .filter((m) => m.type === "out")
      .map((m) => ({
        quantity: Number(m.quantity) || 0,
        at: new Date(m.created_at),
      }))
      .sort((a, b) => a.at - b.at);

    const stats = computePersistedConsumptionStats(outs, new Date());
    if (!stats) return null;

    return ProductRepository.updateConsumptionStats(
      userId,
      productId,
      {
        avgWeeklyUsage: stats.avgWeeklyUsage,
        consumptionCycleDays: stats.consumptionCycleDays,
      },
      client,
    );
  },

  /**
   * Candidatos “atrasados”: estoque > 0, ciclo esperado e além da janela.
   * Mais preciso: prioriza histórico de movimentos / ciclo persistido;
   * fallback repurchase_days só entra com lastConsumedAt conhecido.
   */
  async listOverdueCandidates(userId, { now = new Date() } = {}) {
    const estimates = await this.listEstimates(userId, { now });
    return estimates
      .filter((item) => {
        if (!item.isOverdue) return false;
        if (item.source === "movements" || item.source === "product") return true;
        if (item.source === "repurchase_days" && item.lastConsumedAt) return true;
        return false;
      })
      .sort(
        (a, b) =>
          (b.overdueDays ?? 0) - (a.overdueDays ?? 0) ||
          (b.outCount || 0) - (a.outCount || 0) ||
          (b.daysSinceLastOut || 0) - (a.daysSinceLastOut || 0) ||
          a.name.localeCompare(b.name),
      );
  },
};

module.exports = ConsumptionEstimateService;
