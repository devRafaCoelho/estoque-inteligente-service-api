const PurchaseRepository = require("../repositories/PurchaseRepository");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
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

const FinanceService = {
  async getSummary(userId) {
    const now = new Date();
    const today = startOfDay(now);

    const weekEnd = addDays(today, 1);
    const weekStart = addDays(today, -6);
    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekEnd = weekStart;

    const monthStart = startOfMonth(today);
    const monthEndExclusive = new Date(monthStart);
    monthEndExclusive.setMonth(monthEndExclusive.getMonth() + 1);

    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = monthStart;

    const [week, prevWeek, month, prevMonth, byCategory, recent] = await Promise.all([
      PurchaseRepository.sumTotal(userId, weekStart, weekEnd),
      PurchaseRepository.sumTotal(userId, prevWeekStart, prevWeekEnd),
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
      week: {
        total: week.total,
        count: week.count,
        previousTotal: prevWeek.total,
        deltaPercent: percentDelta(week.total, prevWeek.total),
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
      },
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

  async getSeries(userId, { weeks = 8 } = {}) {
    const series = await PurchaseRepository.weeklySeries(userId, weeks);
    return {
      currency: "BRL",
      granularity: "week",
      series,
    };
  },

  async getTips(userId) {
    const summary = await this.getSummary(userId);
    const tips = [];

    if (summary.week.deltaPercent >= 20 && summary.week.previousTotal > 0) {
      tips.push({
        id: "week_up",
        severity: "warning",
        message: `Você gastou ${summary.week.deltaPercent}% a mais nesta semana do que na anterior.`,
      });
    } else if (summary.week.deltaPercent <= -20 && summary.week.total > 0) {
      tips.push({
        id: "week_down",
        severity: "success",
        message: `Gastos da semana caíram ${Math.abs(summary.week.deltaPercent)}% em relação à anterior.`,
      });
    }

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
