const webpush = require("web-push");
const env = require("../config/env");
const logger = require("../utils/logger");

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

const WebPushService = {
  isConfigured() {
    return ensureConfigured();
  },

  getPublicKey() {
    return env.VAPID_PUBLIC_KEY || "";
  },

  async send(subscription, payload) {
    if (!ensureConfigured()) return { skipped: true, reason: "missing_vapid" };
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        },
        JSON.stringify(payload),
      );
      return { delivered: true };
    } catch (err) {
      logger.warn("Falha ao enviar web push", {
        endpoint: subscription.endpoint,
        statusCode: err.statusCode,
        message: err.message,
      });
      return { delivered: false, statusCode: err.statusCode, message: err.message };
    }
  },
};

module.exports = WebPushService;
