const AppError = require("../utils/AppError");
const NotificationRepository = require("../repositories/NotificationRepository");
const PushSubscriptionRepository = require("../repositories/PushSubscriptionRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const StockMonitorService = require("./StockMonitorService");
const WebPushService = require("./WebPushService");
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

  async getPushConfig(userId) {
    await UserPreferencesRepository.createDefaults(userId);
    const [prefs, subscriptions] = await Promise.all([
      UserPreferencesRepository.findByUser(userId),
      PushSubscriptionRepository.countByUser(userId),
    ]);
    if (!prefs) throw new AppError("Preferências não encontradas", 404);
    if (subscriptions > 0 && prefs.push_enabled !== true) {
      await UserPreferencesRepository.update(userId, { pushEnabled: true });
      prefs.push_enabled = true;
    }
    return {
      supported: WebPushService.isConfigured(),
      vapidPublicKey: WebPushService.getPublicKey(),
      pushEnabled: Boolean(prefs.push_enabled) && subscriptions > 0,
      subscriptions,
    };
  },

  async subscribe(userId, subscription, userAgent) {
    await UserPreferencesRepository.createDefaults(userId);
    await PushSubscriptionRepository.upsert(userId, subscription, userAgent);
    await UserPreferencesRepository.update(userId, { pushEnabled: true });
    return this.getPushConfig(userId);
  },

  async unsubscribe(userId, endpoint) {
    await PushSubscriptionRepository.deleteByUserAndEndpoint(userId, endpoint);
    const count = await PushSubscriptionRepository.countByUser(userId);
    await UserPreferencesRepository.update(userId, { pushEnabled: count > 0 });
    return this.getPushConfig(userId);
  },
};

module.exports = NotificationService;
