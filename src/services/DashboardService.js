const ProductRepository = require("../repositories/ProductRepository");
const NotificationRepository = require("../repositories/NotificationRepository");
const StockMonitorService = require("./StockMonitorService");
const stockStatus = require("../utils/stockStatus");
const { NotificationDto } = require("../dto/v1/notificationDto");
const { ProductListDto } = require("../dto/v1/productDto");

const DashboardService = {
  async getStats(userId) {
    await StockMonitorService.evaluateUserSafe(userId);

    const [products, unreadCount, recentRows] = await Promise.all([
      ProductRepository.list(userId, { active: true }),
      NotificationRepository.countUnread(userId),
      NotificationRepository.list(userId, { unreadOnly: true, limit: 5 }),
    ]);

    let ok = 0;
    let low = 0;
    let out = 0;
    const critical = [];

    for (const product of products) {
      const status = stockStatus(product.quantity, product.min_quantity);
      if (status === "ok") ok += 1;
      else if (status === "low") {
        low += 1;
        critical.push(product);
      } else {
        out += 1;
        critical.push(product);
      }
    }

    critical.sort((a, b) => Number(a.quantity) - Number(b.quantity));

    return {
      stats: {
        total: products.length,
        ok,
        low,
        out,
        unreadNotifications: unreadCount,
      },
      criticalProducts: critical.slice(0, 4).map(ProductListDto),
      recentAlerts: recentRows.map(NotificationDto),
    };
  },
};

module.exports = DashboardService;
