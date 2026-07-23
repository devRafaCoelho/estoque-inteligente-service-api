const PurchaseRepository = require("../repositories/PurchaseRepository");

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

  async getTips(userId) {
    const summary = await this.getSummary(userId);
    const tips = [];

    if (summary.month.total > 0 && summary.byCategory.length) {
      const top = summary.byCategory[0];
      const share = Math.round((top.total / summary.month.total) * 100);
      if (share >= 30) {
        tips.push({
          id: "category_share",
          severity: "info",
          message: `A categoria "${top.category}" representa ${share}% dos gastos do mês.`,
          category: top.category,
        });
      }
    }

    if (summary.month.count === 0) {
      tips.push({
        id: "no_purchases",
        severity: "info",
        message:
          "Ainda não há compras com preço neste mês. Informe o preço unitário no preview da entrada para alimentar o financeiro.",
      });
    } else if (summary.month.deltaPercent >= 20 && summary.month.previousTotal > 0) {
      tips.push({
        id: "month_up",
        severity: "warning",
        message: `Você gastou ${summary.month.deltaPercent}% a mais neste mês do que no anterior.`,
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

    return { tips };
  },
};

module.exports = FinanceService;
