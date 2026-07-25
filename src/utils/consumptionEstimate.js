/** Mínimo de baixas para confiar no intervalo médio calculado. */
const MIN_OUTS_FOR_INTERVAL = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function daysBetween(a, b) {
  return Math.max(0, (b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Agrupa movimentos out por produto.
 * @param {Array<{ product_id: string, quantity: number, created_at: Date|string }>} rows
 */
function groupOutMovements(rows) {
  const byProduct = new Map();
  for (const row of rows) {
    const id = row.product_id;
    if (!byProduct.has(id)) {
      byProduct.set(id, []);
    }
    byProduct.get(id).push({
      quantity: Number(row.quantity) || 0,
      at: new Date(row.created_at),
    });
  }
  return byProduct;
}

/**
 * Intervalo médio (dias) entre baixas consecutivas.
 */
function averageIntervalDays(movements) {
  if (!movements || movements.length < MIN_OUTS_FOR_INTERVAL) return null;
  let sum = 0;
  for (let i = 1; i < movements.length; i += 1) {
    sum += daysBetween(movements[i - 1].at, movements[i].at);
  }
  return sum / (movements.length - 1);
}

/**
 * Média de quantidade saída por semana a partir do histórico.
 */
function averageWeeklyUsageFromMovements(movements, now = new Date()) {
  if (!movements?.length) return null;
  const totalQty = movements.reduce((sum, m) => sum + m.quantity, 0);
  const first = movements[0].at;
  const last = movements[movements.length - 1].at;
  const end = movements.length >= MIN_OUTS_FOR_INTERVAL ? last : now;
  const spanDays = Math.max(1, daysBetween(first, end));
  return (totalQty / spanDays) * 7;
}

/**
 * Monta estimativa de um produto (puro — fácil de testar / reusar no F2-1.4).
 *
 * @param {object} product row do banco
 * @param {Array<{ quantity: number, at: Date }>|undefined} movements
 * @param {Date} [now]
 */
function buildProductEstimate(product, movements = [], now = new Date()) {
  const lastConsumedAt = product.last_consumed_at
    ? new Date(product.last_consumed_at)
    : movements.length
      ? movements[movements.length - 1].at
      : null;

  const daysSinceLastOut = lastConsumedAt
    ? Math.floor(daysBetween(lastConsumedAt, now))
    : null;

  const intervalFromHistory = averageIntervalDays(movements);
  const weeklyFromHistory = averageWeeklyUsageFromMovements(movements, now);

  const storedCycle =
    product.consumption_cycle_days != null
      ? Number(product.consumption_cycle_days)
      : null;
  const storedWeekly =
    product.avg_weekly_usage != null ? Number(product.avg_weekly_usage) : null;
  const repurchaseDays =
    product.repurchase_days != null ? Number(product.repurchase_days) : null;

  let expectedCycleDays = null;
  let avgWeeklyUsage = null;
  let source = null;

  if (intervalFromHistory != null && Number.isFinite(intervalFromHistory)) {
    expectedCycleDays = Math.max(1, Math.round(intervalFromHistory));
    avgWeeklyUsage =
      weeklyFromHistory != null ? round1(weeklyFromHistory) : storedWeekly;
    source = "movements";
  } else if (storedCycle != null && Number.isFinite(storedCycle) && storedCycle >= 1) {
    expectedCycleDays = Math.round(storedCycle);
    avgWeeklyUsage =
      weeklyFromHistory != null
        ? round1(weeklyFromHistory)
        : storedWeekly != null
          ? round1(storedWeekly)
          : null;
    source = "product";
  } else if (
    repurchaseDays != null &&
    Number.isFinite(repurchaseDays) &&
    repurchaseDays >= 1
  ) {
    // Pouco histórico: ciclo de recompra como proxy fraco (doc Fase 2 / v1).
    expectedCycleDays = Math.round(repurchaseDays);
    avgWeeklyUsage =
      weeklyFromHistory != null
        ? round1(weeklyFromHistory)
        : storedWeekly != null
          ? round1(storedWeekly)
          : null;
    source = "repurchase";
  } else if (weeklyFromHistory != null || storedWeekly != null) {
    avgWeeklyUsage = round1(weeklyFromHistory ?? storedWeekly);
    source = weeklyFromHistory != null ? "movements" : "product";
  }

  const outCount = movements.length;
  const isOverdue =
    expectedCycleDays != null &&
    daysSinceLastOut != null &&
    daysSinceLastOut >= expectedCycleDays &&
    Number(product.quantity) > 0;

  return {
    productId: product.id,
    name: product.name,
    unit: product.unit,
    quantity: Number(product.quantity) || 0,
    outCount,
    avgWeeklyUsage,
    expectedCycleDays,
    lastConsumedAt: lastConsumedAt ? lastConsumedAt.toISOString() : null,
    daysSinceLastOut,
    isOverdue,
    source,
  };
}

module.exports = {
  MIN_OUTS_FOR_INTERVAL,
  groupOutMovements,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  buildProductEstimate,
};
