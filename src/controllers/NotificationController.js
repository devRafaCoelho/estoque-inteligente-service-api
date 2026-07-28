const NotificationService = require("../services/NotificationService");

const NotificationController = {
  async list(req, res) {
    const result = await NotificationService.list(req.user.id, req.query);
    return res.status(200).json(result);
  },

  async unreadCount(req, res) {
    const result = await NotificationService.unreadCount(req.user.id);
    return res.status(200).json(result);
  },

  async markRead(req, res) {
    const notification = await NotificationService.markRead(req.user.id, req.params.id);
    return res.status(200).json({ notification });
  },

  async markAllRead(req, res) {
    const result = await NotificationService.markAllRead(req.user.id);
    return res.status(200).json(result);
  },

  async pushConfig(req, res) {
    const result = await NotificationService.getPushConfig(req.user.id);
    return res.status(200).json(result);
  },

  async subscribe(req, res) {
    const result = await NotificationService.subscribe(
      req.user.id,
      req.body,
      req.get("user-agent") || null,
    );
    return res.status(200).json(result);
  },

  async unsubscribe(req, res) {
    const result = await NotificationService.unsubscribe(req.user.id, req.body.endpoint);
    return res.status(200).json(result);
  },
};

module.exports = NotificationController;
