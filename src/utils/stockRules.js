const stockStatus = require("./stockStatus");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {{ repurchase_days?: number|null, last_purchased_at?: Date|string|null }} product
 * @param {number} [now]
 */
function isRepurchaseDue(product, now = Date.now()) {
  const days = Number(product.repurchase_days);
  if (!Number.isFinite(days) || days < 1 || !product.last_purchased_at) {
    return false;
  }
  const dueAt = new Date(product.last_purchased_at).getTime() + days * MS_PER_DAY;
  return Number.isFinite(dueAt) && dueAt <= now;
}

/**
 * Origem sugerida para item de lista de compras (regras).
 * @returns {{ origin: string, priority: 'high'|'medium'|'low' } | null}
 */
function resolveShoppingListOrigin(product, now = Date.now()) {
  const status = stockStatus(product.quantity, product.min_quantity);
  if (status === "out") {
    return { origin: "out_of_stock", priority: "high" };
  }
  if (status === "low") {
    return { origin: "low_stock", priority: "high" };
  }
  if (isRepurchaseDue(product, now)) {
    return { origin: "repurchase_time", priority: "medium" };
  }
  return null;
}

module.exports = {
  MS_PER_DAY,
  isRepurchaseDue,
  resolveShoppingListOrigin,
  stockStatus,
};
