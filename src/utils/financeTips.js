const stockStatus = require("./stockStatus");
const { formatBRLAmount } = require("./money");

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function productStatus(product) {
  return stockStatus(product.quantity ?? product.qty, product.min_quantity ?? product.minQuantity);
}

/**
 * Estima gasto semanal de um produto a partir de sinais reais (não inventa).
 * @returns {{ weeklyCost: number, weeklyUsage: number, unitPrice: number }|null}
 */
function estimateWeeklyCost(product) {
  const weeklyUsage = Number(product.avg_weekly_usage ?? product.avgWeeklyUsage);
  const unitPrice = Number(product.avg_unit_price ?? product.avgUnitPrice);
  if (!Number.isFinite(weeklyUsage) || weeklyUsage <= 0) return null;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  return {
    weeklyUsage: round1(weeklyUsage),
    unitPrice,
    weeklyCost: Math.round(weeklyUsage * unitPrice * 100) / 100,
  };
}

/**
 * Monta dicas financeiras cruzando gastos do mês com padrão de consumo.
 * Só usa números presentes nos fixtures — sem inventar.
 *
 * @param {{
 *   byCategory?: Array<{ category: string, total: number }>,
 *   monthTotal?: number,
 *   summary?: object|null,
 *   products?: object[],
 *   categoryLabels?: Map<string, string>|Record<string, string>,
 *   isCurrentMonth?: boolean,
 * }} input
 * @returns {Array<{ id: string, severity: string, message: string, category?: string, source?: string }>}
 */
function buildFinanceTips({
  byCategory = [],
  monthTotal = 0,
  summary = null,
  products = [],
  categoryLabels = new Map(),
  isCurrentMonth = true,
} = {}) {
  const tips = [];
  const labelOf = (code) => {
    if (categoryLabels instanceof Map) return categoryLabels.get(code) || code;
    return categoryLabels?.[code] || code;
  };

  const total =
    Number.isFinite(Number(monthTotal)) && Number(monthTotal) > 0
      ? Number(monthTotal)
      : (byCategory || []).reduce((sum, row) => sum + (Number(row.total) || 0), 0);

  if (total > 0 && byCategory.length) {
    const top = byCategory[0];
    const share = Math.round((Number(top.total) / total) * 100);
    if (share >= 30) {
      tips.push({
        id: "category_share",
        severity: "info",
        source: "spend",
        message: `A categoria "${labelOf(top.category)}" representa ${share}% dos gastos do mês.`,
        category: top.category,
      });
    }
  }

  if (total <= 0) {
    tips.push({
      id: "no_purchases",
      severity: "info",
      source: "spend",
      message:
        "Ainda não há compras com preço neste mês. Informe o preço unitário no preview da entrada para alimentar o financeiro.",
    });
  } else if (isCurrentMonth && summary?.month) {
    if (summary.month.deltaPercent >= 20 && summary.month.previousTotal > 0) {
      const extra = Math.max(
        0,
        Number(summary.month.total) - Number(summary.month.previousTotal),
      );
      tips.push({
        id: "month_up",
        severity: "warning",
        source: "spend",
        message: `Você gastou R$ ${formatBRLAmount(extra)} a mais neste mês do que no anterior.`,
      });
    } else if (
      summary.month.projectedTotal > 0 &&
      summary.month.previousTotal > 0 &&
      summary.month.projectedTotal > summary.month.previousTotal * 1.15
    ) {
      tips.push({
        id: "month_projection",
        severity: "warning",
        source: "spend",
        message: `No ritmo atual, o mês pode fechar em torno de R$ ${formatBRLAmount(summary.month.projectedTotal)} (acima do mês passado).`,
      });
    }
  }

  // --- Consumo × preço (só com sinais reais) ---
  const activeProducts = (products || []).filter((p) => p && p.active !== false);
  const lowOutWithCost = [];
  for (const product of activeProducts) {
    const status = productStatus(product);
    if (status !== "low" && status !== "out") continue;
    const estimate = estimateWeeklyCost(product);
    if (!estimate) continue;
    lowOutWithCost.push({
      product,
      status,
      ...estimate,
    });
  }

  if (lowOutWithCost.length) {
    lowOutWithCost.sort((a, b) => b.weeklyCost - a.weeklyCost);
    const top = lowOutWithCost[0];
    const statusLabel = top.status === "out" ? "zerado" : "acabando";
    tips.push({
      id: "consumption_low_out_cost",
      severity: "warning",
      source: "consumption",
      productId: top.product.id || top.product.productId || null,
      message: `"${top.product.name}" está ${statusLabel} e, pelo seu uso (~${top.weeklyUsage} ${top.product.unit || "un"}/sem. a R$ ${formatBRLAmount(top.unitPrice)}), isso pesa cerca de R$ ${formatBRLAmount(top.weeklyCost)} por semana se você repor no ritmo usual.`,
    });

    if (lowOutWithCost.length >= 2) {
      const sumWeekly = Math.round(
        lowOutWithCost.slice(0, 5).reduce((s, row) => s + row.weeklyCost, 0) * 100,
      ) / 100;
      tips.push({
        id: "consumption_low_out_bundle",
        severity: "info",
        source: "consumption",
        message: `${Math.min(5, lowOutWithCost.length)} itens baixos/zerados com preço e consumo conhecidos somam cerca de R$ ${formatBRLAmount(sumWeekly)}/semana no ritmo usual.`,
      });
    }
  }

  // Produto com alto consumo semanal (mesmo ok) — só se houver preço
  const heavyUsage = activeProducts
    .map((product) => {
      const estimate = estimateWeeklyCost(product);
      if (!estimate || estimate.weeklyCost < 15) return null;
      const status = productStatus(product);
      if (status !== "ok") return null;
      return { product, ...estimate };
    })
    .filter(Boolean)
    .sort((a, b) => b.weeklyCost - a.weeklyCost);

  if (heavyUsage.length && !tips.some((t) => t.id === "consumption_low_out_cost")) {
    const top = heavyUsage[0];
    tips.push({
      id: "consumption_heavy_usage",
      severity: "info",
      source: "consumption",
      productId: top.product.id || null,
      message: `"${top.product.name}" é um dos itens de maior consumo estimado (~${top.weeklyUsage} ${top.product.unit || "un"}/sem.), cerca de R$ ${formatBRLAmount(top.weeklyCost)} por semana pelo preço médio registrado.`,
    });
  }

  if (!tips.length) {
    tips.push({
      id: "generic_safe",
      severity: "info",
      source: "generic",
      message:
        "Ainda há poucos dados de gasto e consumo. Registre preços nas entradas e baixas para dicas mais precisas.",
    });
  }

  return tips;
}

module.exports = {
  buildFinanceTips,
  estimateWeeklyCost,
};
