/** Mínimo de baixas para calcular intervalo médio. */
const MIN_OUTS_FOR_INTERVAL = 2;
/** Histórico mínimo para estimativa estável (persistência / monitores precisos). */
const MIN_OUTS_FOR_STABLE = 3;
/** Intervalos acima disso são ignorados (gaps antigos / abandono). */
const MAX_INTERVAL_DAYS = 180;
/** Quantidade máxima de baixas recentes no cálculo. */
const MAX_OUTS_WINDOW = 24;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function daysBetween(a, b) {
  return Math.max(0, (b.getTime() - a.getTime()) / MS_PER_DAY);
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Remove intervalos outliers vs mediana (muito curtos/longos).
 * Com menos de 3 intervalos, devolve a lista original.
 */
function trimIntervalOutliers(intervals) {
  if (!intervals || intervals.length < 3) return [...(intervals || [])];

  const sorted = [...intervals].sort((a, b) => a - b);
  const med = median(sorted);
  if (!med || med <= 0) return [...intervals];

  const filtered = intervals.filter((d) => d >= med * 0.4 && d <= med * 2.5);
  return filtered.length >= 2 ? filtered : [...intervals];
}

function normalizeMovements(movements = []) {
  return (movements || [])
    .map((m) => ({
      quantity: Number(m.quantity) || 0,
      at: m.at instanceof Date ? m.at : new Date(m.at || m.created_at || m.createdAt),
    }))
    .filter((m) => m.at && !Number.isNaN(m.at.getTime()))
    .sort((a, b) => a.at - b.at);
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
 * Intervalos (dias) entre baixas consecutivas, com janela e outliers.
 */
function listIntervalsDays(movements) {
  const sorted = normalizeMovements(movements).slice(-MAX_OUTS_WINDOW);
  if (sorted.length < MIN_OUTS_FOR_INTERVAL) return [];

  const intervals = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const days = daysBetween(sorted[i - 1].at, sorted[i].at);
    if (days > 0 && days <= MAX_INTERVAL_DAYS) {
      intervals.push(days);
    }
  }
  return trimIntervalOutliers(intervals);
}

/**
 * Intervalo médio (dias) entre baixas consecutivas.
 */
function averageIntervalDays(movements) {
  const intervals = listIntervalsDays(movements);
  if (!intervals.length) return null;
  return intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
}

/**
 * Média de quantidade saída por semana a partir do histórico.
 */
function averageWeeklyUsageFromMovements(movements, now = new Date()) {
  const sorted = normalizeMovements(movements);
  if (!sorted.length) return null;

  const totalQty = sorted.reduce((sum, m) => sum + m.quantity, 0);
  const first = sorted[0].at;
  const last = sorted[sorted.length - 1].at;
  const end = sorted.length >= MIN_OUTS_FOR_INTERVAL ? last : now;
  const spanDays = Math.max(1, daysBetween(first, end));
  return (totalQty / spanDays) * 7;
}

/**
 * Sinais persistíveis quando há histórico estável (≥ MIN_OUTS_FOR_STABLE).
 * Não inventa valores sem histórico mínimo.
 */
function computePersistedConsumptionStats(movements = [], now = new Date()) {
  const sorted = normalizeMovements(movements);
  if (sorted.length < MIN_OUTS_FOR_STABLE) return null;

  const interval = averageIntervalDays(sorted);
  if (interval == null || !Number.isFinite(interval)) return null;

  const weekly = averageWeeklyUsageFromMovements(sorted, now);
  return {
    avgWeeklyUsage: weekly != null ? round1(weekly) : null,
    consumptionCycleDays: Math.max(1, Math.round(interval)),
    outCount: sorted.length,
  };
}

function resolveConfidence({ source, outCount }) {
  if (source === "movements" && outCount >= MIN_OUTS_FOR_STABLE) return "high";
  if (source === "movements") return "medium";
  if (source === "product") return "medium";
  if (source === "repurchase" || source === "repurchase_days") return "low";
  return "none";
}

/**
 * Monta estimativa de um produto (puro — reutilizável por monitor, chat e financeiro).
 *
 * @param {object} product row do banco
 * @param {Array<{ quantity: number, at: Date }>|undefined} movements
 * @param {Date} [now]
 */
function buildProductEstimate(product, movements = [], now = new Date()) {
  const normalized = normalizeMovements(movements);

  const lastConsumedAt = product.last_consumed_at
    ? new Date(product.last_consumed_at)
    : normalized.length
      ? normalized[normalized.length - 1].at
      : null;

  const daysSinceLastOut = lastConsumedAt
    ? Math.floor(daysBetween(lastConsumedAt, now))
    : null;

  const intervalFromHistory = averageIntervalDays(normalized);
  const weeklyFromHistory = averageWeeklyUsageFromMovements(normalized, now);

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
    // Ciclo já persistido a partir de histórico anterior — não inventa do zero.
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
    // Sem histórico mínimo: repurchase_days como fallback explícito.
    expectedCycleDays = Math.round(repurchaseDays);
    avgWeeklyUsage =
      weeklyFromHistory != null
        ? round1(weeklyFromHistory)
        : storedWeekly != null
          ? round1(storedWeekly)
          : null;
    source = "repurchase_days";
  } else if (weeklyFromHistory != null || storedWeekly != null) {
    avgWeeklyUsage = round1(weeklyFromHistory ?? storedWeekly);
    source = weeklyFromHistory != null ? "movements" : "product";
  }

  const outCount = normalized.length;
  const confidence = resolveConfidence({ source, outCount });
  const overdueDays =
    expectedCycleDays != null && daysSinceLastOut != null
      ? daysSinceLastOut - expectedCycleDays
      : null;

  const isOverdue =
    expectedCycleDays != null &&
    daysSinceLastOut != null &&
    daysSinceLastOut >= expectedCycleDays &&
    Number(product.quantity) > 0;

  return {
    productId: product.id,
    name: product.name,
    unit: product.unit,
    category: product.category || null,
    quantity: Number(product.quantity) || 0,
    outCount,
    avgWeeklyUsage,
    expectedCycleDays,
    lastConsumedAt: lastConsumedAt ? lastConsumedAt.toISOString() : null,
    daysSinceLastOut,
    overdueDays,
    isOverdue,
    source,
    confidence,
    stable: source === "movements" && outCount >= MIN_OUTS_FOR_STABLE,
  };
}

/**
 * Quantidade “usual” sugerida para uma baixa rápida (editável no client).
 * Só calcula quando há estimativa de uso; não inventa do zero.
 * Limita ao estoque atual quando conhecido.
 */
function suggestedUsualQuantity(estimate) {
  if (!estimate) return null;

  const weekly = Number(estimate.avgWeeklyUsage);
  const cycle = Number(estimate.expectedCycleDays);
  const stock = Number(estimate.quantity);

  let qty = null;
  if (Number.isFinite(weekly) && weekly > 0 && Number.isFinite(cycle) && cycle > 0) {
    qty = weekly * (cycle / 7);
  } else if (Number.isFinite(weekly) && weekly > 0) {
    qty = weekly;
  }

  if (qty == null || !Number.isFinite(qty) || qty <= 0) return null;

  qty = round1(qty);
  if (qty >= 1) {
    const nearest = Math.round(qty);
    if (Math.abs(qty - nearest) < 0.15) qty = nearest;
  }

  if (Number.isFinite(stock) && stock > 0) {
    qty = Math.min(qty, stock);
  }

  return qty > 0 ? qty : null;
}

/**
 * Item de payload de nudge a partir de uma estimativa.
 */
function toNudgePayloadItem(estimate) {
  const suggestedQuantity = suggestedUsualQuantity(estimate);
  return {
    productId: estimate.productId,
    name: estimate.name,
    daysSinceLastOut: estimate.daysSinceLastOut ?? null,
    expectedCycleDays: estimate.expectedCycleDays ?? null,
    avgWeeklyUsage: estimate.avgWeeklyUsage ?? null,
    unit: estimate.unit || null,
    ...(suggestedQuantity != null ? { suggestedQuantity } : {}),
  };
}

/**
 * Payload de missing_consumption / consumption_nudge com suggestedQuantity.
 */
function buildQuickConsumeNudgePayload({
  candidates = [],
  nudgeDays,
  extra = {},
}) {
  const items = candidates.slice(0, 8).map(toNudgePayloadItem);
  const productIds = candidates.map((c) => c.productId).filter(Boolean);
  const primary = candidates[0] || null;
  const suggestedQuantity = primary ? suggestedUsualQuantity(primary) : null;
  const hasUsual =
    suggestedQuantity != null ||
    items.some((item) => item.suggestedQuantity != null);

  return {
    // Fase 3: baixa usual; Fase 2 client ainda aceita open_quick_consume como alias
    action: hasUsual ? "quick_consume_usual" : "open_quick_consume",
    nudgeDays,
    overdueCount: candidates.length,
    productIds,
    items,
    ...(primary && candidates.length === 1
      ? {
          productId: primary.productId,
          unit: primary.unit || null,
          ...(suggestedQuantity != null ? { suggestedQuantity } : {}),
        }
      : {}),
    ...extra,
  };
}

module.exports = {
  MIN_OUTS_FOR_INTERVAL,
  MIN_OUTS_FOR_STABLE,
  MAX_INTERVAL_DAYS,
  groupOutMovements,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  listIntervalsDays,
  trimIntervalOutliers,
  computePersistedConsumptionStats,
  buildProductEstimate,
  suggestedUsualQuantity,
  toNudgePayloadItem,
  buildQuickConsumeNudgePayload,
};
