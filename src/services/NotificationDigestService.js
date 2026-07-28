const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const NotificationRepository = require("../repositories/NotificationRepository");
const UserRepository = require("../repositories/UserRepository");
const EmailService = require("./EmailService");
const DeliveryWindowService = require("./DeliveryWindowService");
const { digestEmail } = require("../mail/emailLayout");
const { buildDisplayName } = require("../helpers/personName");

const NotificationDigestService = {
  async sendDigestForUser(userId) {
    const [prefs, user] = await Promise.all([
      UserPreferencesRepository.findByUser(userId),
      UserRepository.findById(userId),
    ]);
    if (!prefs || !user || prefs.notify_email_digest !== true) {
      return { sent: false, reason: "disabled" };
    }
    if (DeliveryWindowService.isQuietHoursActive(prefs)) {
      return { sent: false, reason: "quiet_hours" };
    }

    const notifications = await NotificationRepository.list(userId, { unreadOnly: true, limit: 20 });
    const baseline = prefs.last_email_digest_at ? new Date(prefs.last_email_digest_at).getTime() : 0;
    const fresh = notifications.filter((item) => new Date(item.created_at).getTime() > baseline);
    if (!fresh.length) return { sent: false, reason: "empty" };

    const mail = digestEmail({
      firstName: user.first_name || buildDisplayName(user).split(/\s+/)[0],
      notifications: fresh,
    });
    await EmailService.send({
      to: user.email,
      ...mail,
    });
    await UserPreferencesRepository.touchDigestSentAt(userId);
    return { sent: true, count: fresh.length };
  },
};

module.exports = NotificationDigestService;
