const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const ProductRepository = require("../repositories/ProductRepository");
const NotificationRepository = require("../repositories/NotificationRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const ConsumptionEstimateService = require("./ConsumptionEstimateService");
const stockStatus = require("../utils/stockStatus");
const logger = require("../utils/logger");

const STOCK_DEDUP_HOURS = 72;
const REPURCHASE_DEDUP_HOURS = 72;
const DEFAULT_NUDGE_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatQty(quantity, unit) {
  const n = Number(quantity);
  const pretty = Number.isInteger(n) ? String(n) : String(n);
  return `${pretty} ${unit || "un"}`;
}

function daysSince(date) {
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / MS_PER_DAY));
}

function isRepurchaseDue(product, now = Date.now()) {
  const days = Number(product.repurchase_days);
  if (!Number.isFinite(days) || days < 1 || !product.last_purchased_at) {
    return false;
  }
  const dueAt =
    new Date(product.last_purchased_at).getTime() + days * MS_PER_DAY;
  return Number.isFinite(dueAt) && dueAt <= now;
}

async function ensureStockAlert(userId, { type, product, title, body }) {
  const existing = await NotificationRepository.findRecentForProduct(
    userId,
    type,
    product.id,
    STOCK_DEDUP_HOURS,
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

async function ensureRepurchaseReminder(userId, product) {
  if (!isRepurchaseDue(product)) return false;

  const existing = await NotificationRepository.findRecentForProduct(
    userId,
    "repurchase_reminder",
    product.id,
    REPURCHASE_DEDUP_HOURS,
  );
  if (existing) return false;

  const elapsed = daysSince(product.last_purchased_at);
  const cycle = Number(product.repurchase_days);
  const body =
    elapsed == null
      ? `Já passou o intervalo de ${cycle} dias para repor "${product.name}".`
      : `A última vez que você comprou "${product.name}" foi há ${elapsed} dia${elapsed === 1 ? "" : "s"} (ciclo de ${cycle} dias).`;

  await NotificationRepository.create({
    userId,
    type: "repurchase_reminder",
    title: `${product.name}: recompra sugerida`,
    body,
    productId: product.id,
    payload: {
      action: "open_product",
      productId: product.id,
      repurchaseDays: cycle,
      lastPurchasedAt: product.last_purchased_at,
      daysSincePurchase: elapsed,
      quantity: Number(product.quantity),
      unit: product.unit,
    },
  });
  return true;
}

async function ensureConsumptionNudge(userId, prefs) {
  if (prefs.notify_consumption_nudge === false) return false;

  const days = Number(prefs.consumption_nudge_days) || DEFAULT_NUDGE_DAYS;
  const recentNudge = await NotificationRepository.findRecentByType(
    userId,
    "consumption_nudge",
    days,
  );
  if (recentNudge) return false;

  const outCount = await StockMovementRepository.countOutSinceDays(userId, days);
  if (outCount > 0) return false;

  const products = await ProductRepository.list(userId, { active: true });
  const withStock = products.filter((p) => Number(p.quantity) > 0);
  if (!withStock.length) return false;

  const lastOutAt = await StockMovementRepository.findLastOutAt(userId);
  const body = lastOutAt
    ? `Faz ${days} dias sem nenhuma baixa no estoque — quer revisar o que usou?`
    : `Você ainda não registrou baixas. Quando consumir algo, registre para manter o estoque atualizado.`;

  await NotificationRepository.create({
    userId,
    type: "consumption_nudge",
    title: "Não esqueceu de dar baixa?",
    body,
    productId: null,
    payload: {
      action: "open_quick_consume",
      nudgeDays: days,
      productsWithStock: withStock.length,
    },
  });
  return true;
}

const StockMonitorService = {
  /**
   * Avalia estoque baixo/zerado, recompra por tempo e lembrete genérico de baixa.
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
        const ok = await ensureStockAlert(userId, {
          type: "out_of_stock",
          product,
          title: `${product.name} acabou`,
          body: `O item "${product.name}" está com estoque zerado.`,
        });
        if (ok) created += 1;
      } else if (status === "low" && prefs.notify_low_stock !== false) {
        const ok = await ensureStockAlert(userId, {
          type: "low_stock",
          product,
          title: `${product.name} está acabando`,
          body: `Restam ${formatQty(product.quantity, product.unit)} (mínimo ${formatQty(product.min_quantity, product.unit)}).`,
        });
        if (ok) created += 1;
      }

      if (prefs.notify_repurchase !== false) {
        if (await ensureRepurchaseReminder(userId, product)) {
          created += 1;
        }
      }
    }

    if (await ensureConsumptionNudge(userId, prefs)) {
      created += 1;
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

  /**
   * Candidatos atrasados no padrão de consumo (F2-1.3) — usado pelo nudge agrupado (F2-1.4).
   */
  listOverdueConsumptionCandidates(userId, options) {
    return ConsumptionEstimateService.listOverdueCandidates(userId, options);
  },
};

module.exports = StockMonitorService;
