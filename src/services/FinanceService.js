const PurchaseRepository = require("../repositories/PurchaseRepository");
const CatalogService = require("./CatalogService");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function percentDelta(current, previous) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const FinanceService = {
  resolveMonthRange(year, month) {
    const now = new Date();
    const targetYear = Number(year) || now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let targetMonth = Number(month) || currentMonth;

    if (
      !Number.isInteger(targetMonth) ||
      targetMonth < 1 ||
      targetMonth > 12 ||
      (targetYear === now.getFullYear() && targetMonth > currentMonth)
    ) {
      targetMonth = currentMonth;
    }

    const from = new Date(targetYear, targetMonth - 1, 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(targetYear, targetMonth, 1);
    to.setHours(0, 0, 0, 0);

    return {
      year: targetYear,
      month: targetMonth,
      label: MONTH_LABELS[targetMonth - 1],
      from,
      to,
    };
  },

  async getByCategory(userId, { year, month } = {}) {
    const range = this.resolveMonthRange(year, month);
    const byCategory = await PurchaseRepository.byCategory(userId, range.from, range.to);
    return {
      currency: "BRL",
      year: range.year,
      month: range.month,
      label: range.label,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      byCategory,
    };
  },

  async getSummary(userId) {
    const now = new Date();
    const today = startOfDay(now);

    const monthStart = startOfMonth(today);
    const monthEndExclusive = new Date(monthStart);
    monthEndExclusive.setMonth(monthEndExclusive.getMonth() + 1);

    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = monthStart;

    const [month, prevMonth, byCategory, recent] = await Promise.all([
      PurchaseRepository.sumTotal(userId, monthStart, monthEndExclusive),
      PurchaseRepository.sumTotal(userId, prevMonthStart, prevMonthEnd),
      PurchaseRepository.byCategory(userId, monthStart, monthEndExclusive),
      PurchaseRepository.listRecent(userId, 8),
    ]);

    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    const projectedMonth =
      dayOfMonth > 0
        ? Math.round((month.total / dayOfMonth) * daysInMonth * 100) / 100
        : 0;

    return {
      currency: "BRL",
      month: {
        total: month.total,
        count: month.count,
        previousTotal: prevMonth.total,
        deltaPercent: percentDelta(month.total, prevMonth.total),
        projectedTotal: projectedMonth,
        from: monthStart.toISOString(),
        to: monthEndExclusive.toISOString(),
      },
      byCategory,
      recentPurchases: recent.map((row) => ({
        id: row.id,
        storeName: row.store_name || null,
        purchasedAt: row.purchased_at,
        totalAmount: Number(row.total_amount) || 0,
        currency: row.currency || "BRL",
      })),
    };
  },

  async getSeries(userId, { year } = {}) {
    const currentYear = new Date().getFullYear();
    const targetYear = Number(year) || currentYear;
    const currentMonth = new Date().getMonth() + 1;
    const lastMonth = targetYear === currentYear ? currentMonth : 12;

    const rows = await PurchaseRepository.monthlySeries(userId, targetYear);
    const byMonth = new Map(rows.map((row) => [row.month, row]));

    const series = [];
    for (let month = 1; month <= lastMonth; month += 1) {
      const found = byMonth.get(month);
      series.push({
        year: targetYear,
        month,
        label: MONTH_LABELS[month - 1],
        total: found?.total || 0,
        count: found?.count || 0,
      });
    }

    return {
      currency: "BRL",
      granularity: "month",
      year: targetYear,
      series,
    };
  },

  async getTips(userId, { year, month } = {}) {
    const range = this.resolveMonthRange(year, month);
    const now = new Date();
    const isCurrentMonth =
      range.year === now.getFullYear() && range.month === now.getMonth() + 1;

    const [categoryData, catalog, summary] = await Promise.all([
      this.getByCategory(userId, { year: range.year, month: range.month }),
      CatalogService.listCategories(),
      isCurrentMonth ? this.getSummary(userId) : Promise.resolve(null),
    ]);

    const tips = [];
    const categoryLabels = new Map(
      (catalog.categories || []).map((item) => [item.code, item.label]),
    );
    const byCategory = categoryData.byCategory || [];
    const monthTotal = byCategory.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

    if (monthTotal > 0 && byCategory.length) {
      const top = byCategory[0];
      const share = Math.round((Number(top.total) / monthTotal) * 100);
      if (share >= 30) {
        const categoryName = categoryLabels.get(top.category) || top.category;
        tips.push({
          id: "category_share",
          severity: "info",
          message: `A categoria "${categoryName}" representa ${share}% dos gastos do mês.`,
          category: top.category,
        });
      }
    }

    if (monthTotal <= 0) {
      tips.push({
        id: "no_purchases",
        severity: "info",
        message:
          "Ainda não há compras com preço neste mês. Informe o preço unitário no preview da entrada para alimentar o financeiro.",
      });
    } else if (isCurrentMonth && summary) {
      if (summary.month.deltaPercent >= 20 && summary.month.previousTotal > 0) {
        const extra = Math.max(
          0,
          Number(summary.month.total) - Number(summary.month.previousTotal),
        );
        tips.push({
          id: "month_up",
          severity: "warning",
          message: `Você gastou R$ ${extra.toFixed(2).replace(".", ",")} a mais neste mês do que no anterior.`,
        });
      } else if (
        summary.month.projectedTotal > 0 &&
        summary.month.previousTotal > 0 &&
        summary.month.projectedTotal > summary.month.previousTotal * 1.15
      ) {
        tips.push({
          id: "month_projection",
          severity: "warning",
          message: `No ritmo atual, o mês pode fechar em torno de R$ ${summary.month.projectedTotal.toFixed(2).replace(".", ",")} (acima do mês passado).`,
        });
      }
    }

    return {
      tips,
      year: range.year,
      month: range.month,
    };
  },
};

module.exports = FinanceService;
