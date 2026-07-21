const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const ProductRepository = require("../repositories/ProductRepository");
const NotificationRepository = require("../repositories/NotificationRepository");
const stockStatus = require("../utils/stockStatus");
const logger = require("../utils/logger");

const DEDUP_HOURS = 72;

function formatQty(quantity, unit) {
  const n = Number(quantity);
  const pretty = Number.isInteger(n) ? String(n) : String(n);
  return `${pretty} ${unit || "un"}`;
}

async function ensureAlert(userId, { type, product, title, body }) {
  const existing = await NotificationRepository.findRecentUnread(
    userId,
    type,
    product.id,
    DEDUP_HOURS,
  );
  if (existing) return false;

  await NotificationRepository.create({
    userId,
    type,
    title,
    body,
    productId: product.id,
    payload: {
      action: "open_product",
      productId: product.id,
      quantity: Number(product.quantity),
      unit: product.unit,
      minQuantity: Number(product.min_quantity),
      stockStatus: type === "out_of_stock" ? "out" : "low",
    },
  });
  return true;
}

const StockMonitorService = {
  /**
   * Avalia estoque baixo/zerado e cria notificações in-app (com deduplicação).
   * Fase 1: apenas low_stock e out_of_stock.
   */
  async evaluateUser(userId) {
    let prefs = await UserPreferencesRepository.findByUser(userId);
    if (!prefs) {
      await UserPreferencesRepository.createDefaults(userId);
      prefs = await UserPreferencesRepository.findByUser(userId);
    }

    const products = await ProductRepository.list(userId, { active: true });
    let created = 0;

    for (const product of products) {
      const status = stockStatus(product.quantity, product.min_quantity);

      if (status === "out" && prefs.notify_out_of_stock !== false) {
        const ok = await ensureAlert(userId, {
          type: "out_of_stock",
          product,
          title: `${product.name} acabou`,
          body: `O item "${product.name}" está com estoque zerado.`,
        });
        if (ok) created += 1;
      } else if (status === "low" && prefs.notify_low_stock !== false) {
        const ok = await ensureAlert(userId, {
          type: "low_stock",
          product,
          title: `${product.name} está acabando`,
          body: `Restam ${formatQty(product.quantity, product.unit)} (mínimo ${formatQty(product.min_quantity, product.unit)}).`,
        });
        if (ok) created += 1;
      }
    }

    if (created > 0) {
      logger.info("Stock monitor created notifications", { userId, created });
    }

    return { created };
  },

  async evaluateUserSafe(userId) {
    try {
      return await this.evaluateUser(userId);
    } catch (err) {
      logger.warn("Stock monitor evaluate failed", {
        userId,
        message: err.message,
      });
      return { created: 0, error: err.message };
    }
  },
};

module.exports = StockMonitorService;
