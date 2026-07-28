const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const ProductRepository = require("../repositories/ProductRepository");
const NotificationRepository = require("../repositories/NotificationRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const ConsumptionEstimateService = require("./ConsumptionEstimateService");
const NotificationDispatchService = require("./NotificationDispatchService");
const stockStatus = require("../utils/stockStatus");
const { isRepurchaseDue, MS_PER_DAY } = require("../utils/stockRules");
const logger = require("../utils/logger");

const STOCK_DEDUP_HOURS = 72;
const REPURCHASE_DEDUP_HOURS = 72;
const DEFAULT_NUDGE_DAYS = 5;

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

async function ensureStockAlert(userId, { type, product, title, body }) {
  const existing = await NotificationRepository.findRecentForProduct(
    userId,
    type,
    product.id,
    STOCK_DEDUP_HOURS,
  );
  if (existing) return false;

  await NotificationDispatchService.createNotification({
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

  await NotificationDispatchService.createNotification({
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

async function hasRecentConsumptionReminder(userId, days) {
  const [generic, patterned] = await Promise.all([
    NotificationRepository.findRecentByType(userId, "consumption_nudge", days),
    NotificationRepository.findRecentByType(userId, "missing_consumption", days),
  ]);
  return Boolean(generic || patterned);
}

function formatOverdueNames(candidates, limit = 3) {
  const names = candidates.map((item) => item.name);
  if (names.length <= limit) {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} e ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  }
  const shown = names.slice(0, limit).join(", ");
  const rest = names.length - limit;
  return `${shown} e mais ${rest}`;
}

async function ensureMissingConsumptionNudge(userId, prefs) {
  if (prefs.notify_consumption_nudge === false) return false;

  const days = Number(prefs.consumption_nudge_days) || DEFAULT_NUDGE_DAYS;
  if (await hasRecentConsumptionReminder(userId, days)) return false;

  const overdue = await ConsumptionEstimateService.listOverdueCandidates(userId);
  if (!overdue.length) return false;

  const count = overdue.length;
  const title =
    count === 1
      ? "Baixa em atraso no padrão de uso"
      : `${count} itens sem baixa no ritmo usual`;
  const body =
    count === 1
      ? `Você costuma registrar baixa em "${overdue[0].name}" com mais frequência — faz ${overdue[0].daysSinceLastOut} dia${overdue[0].daysSinceLastOut === 1 ? "" : "s"} sem movimento.`
      : `${formatOverdueNames(overdue)} estão além do intervalo usual de consumo. Quer registrar o que usou?`;

  await NotificationDispatchService.createNotification({
    userId,
    type: "missing_consumption",
    title,
    body,
    productId: count === 1 ? overdue[0].productId : null,
    payload: {
      action: "open_quick_consume",
      nudgeDays: days,
      overdueCount: count,
      productIds: overdue.map((item) => item.productId),
      items: overdue.slice(0, 8).map((item) => ({
        productId: item.productId,
        name: item.name,
        daysSinceLastOut: item.daysSinceLastOut,
        expectedCycleDays: item.expectedCycleDays,
        avgWeeklyUsage: item.avgWeeklyUsage,
        unit: item.unit,
      })),
    },
  });
  return true;
}

async function ensureConsumptionNudge(userId, prefs) {
  if (prefs.notify_consumption_nudge === false) return false;

  const days = Number(prefs.consumption_nudge_days) || DEFAULT_NUDGE_DAYS;
  if (await hasRecentConsumptionReminder(userId, days)) return false;

  const outCount = await StockMovementRepository.countOutSinceDays(userId, days);
  if (outCount > 0) return false;

  const products = await ProductRepository.list(userId, { active: true });
  const withStock = products.filter((p) => Number(p.quantity) > 0);
  if (!withStock.length) return false;

  const lastOutAt = await StockMovementRepository.findLastOutAt(userId);
  const body = lastOutAt
    ? `Faz ${days} dias sem nenhuma baixa no estoque — quer revisar o que usou?`
    : `Você ainda não registrou baixas. Quando consumir algo, registre para manter o estoque atualizado.`;

  await NotificationDispatchService.createNotification({
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
   * Avalia estoque baixo/zerado, recompra por tempo e lembretes de baixa
   * (padrão de consumo agrupado + genérico).
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

    if (await ensureMissingConsumptionNudge(userId, prefs)) {
      created += 1;
    } else if (await ensureConsumptionNudge(userId, prefs)) {
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
