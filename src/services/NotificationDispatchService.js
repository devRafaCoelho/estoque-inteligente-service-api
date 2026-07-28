const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const NotificationRepository = require("../repositories/NotificationRepository");
const PushSubscriptionRepository = require("../repositories/PushSubscriptionRepository");
const NotificationPreferenceService = require("./NotificationPreferenceService");
const DeliveryWindowService = require("./DeliveryWindowService");
const WebPushService = require("./WebPushService");

function buildPushPayload(notification) {
  return {
    title: notification.title,
    body: notification.body,
    tag: `notification:${notification.id}`,
    data: {
      id: notification.id,
      type: notification.type,
      productId: notification.product_id || null,
      payload: notification.payload || {},
      url: "/notificacoes",
    },
  };
}

const NotificationDispatchService = {
  async createNotification(input, { prefs = null, client } = {}) {
    const notification = await NotificationRepository.create(input, client);
    const resolvedPrefs = prefs || (await UserPreferencesRepository.findByUser(input.userId, client));

    if (
      resolvedPrefs &&
      resolvedPrefs.push_enabled &&
      NotificationPreferenceService.isTypeEnabled(resolvedPrefs, input.type) &&
      !DeliveryWindowService.isQuietHoursActive(resolvedPrefs)
    ) {
      const subscriptions = await PushSubscriptionRepository.listByUser(input.userId, client);
      await Promise.all(
        subscriptions.map(async (subscription) => {
          const result = await WebPushService.send(subscription, buildPushPayload(notification));
          if (result?.statusCode === 404 || result?.statusCode === 410) {
            await PushSubscriptionRepository.deleteByEndpoint(subscription.endpoint, client);
          }
        }),
      );
    }

    return notification;
  },
};

module.exports = NotificationDispatchService;
