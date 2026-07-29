const PurchaseRepository = require("../repositories/PurchaseRepository");
const ProductRepository = require("../repositories/ProductRepository");
const CatalogService = require("./CatalogService");
const { startOfDay, startOfMonth, monthRange } = require("../utils/dateRange");
const { buildFinanceTips } = require("../utils/financeTips");

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

    const { from, to } = monthRange(targetYear, targetMonth);

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

    const [categoryData, catalog, summary, products] = await Promise.all([
      this.getByCategory(userId, { year: range.year, month: range.month }),
      CatalogService.listCategories(),
      isCurrentMonth ? this.getSummary(userId) : Promise.resolve(null),
      ProductRepository.list(userId, { active: true }),
    ]);

    const categoryLabels = new Map(
      (catalog.categories || []).map((item) => [item.code, item.label]),
    );
    const byCategory = categoryData.byCategory || [];
    const monthTotal = byCategory.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

    const tips = buildFinanceTips({
      byCategory,
      monthTotal,
      summary,
      products,
      categoryLabels,
      isCurrentMonth,
    });

    return {
      tips,
      year: range.year,
      month: range.month,
    };
  },
};

module.exports = FinanceService;
