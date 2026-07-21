const AppError = require("../utils/AppError");
const NotificationRepository = require("../repositories/NotificationRepository");
const StockMonitorService = require("./StockMonitorService");
const { NotificationDto } = require("../dto/v1/notificationDto");

const NotificationService = {
  async list(userId, query = {}) {
    await StockMonitorService.evaluateUserSafe(userId);

    const unreadOnly = query.unreadOnly === true || query.unreadOnly === "true";
    const limit = query.limit != null ? Number(query.limit) : 50;

    const [rows, unreadCount] = await Promise.all([
      NotificationRepository.list(userId, { unreadOnly, limit }),
      NotificationRepository.countUnread(userId),
    ]);

    return {
      notifications: rows.map(NotificationDto),
      unreadCount,
    };
  },

  async markRead(userId, id) {
    const row = await NotificationRepository.markRead(userId, id);
    if (!row) throw new AppError("Notificação não encontrada", 404);
    return NotificationDto(row);
  },

  async markAllRead(userId) {
    const updated = await NotificationRepository.markAllRead(userId);
    return { updated, unreadCount: 0 };
  },

  async unreadCount(userId) {
    await StockMonitorService.evaluateUserSafe(userId);
    const unreadCount = await NotificationRepository.countUnread(userId);
    return { unreadCount };
  },
};

module.exports = NotificationService;
