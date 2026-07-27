const ChatService = require("../services/ChatService");

const ChatController = {
  async getSession(req, res) {
    const result = await ChatService.getCurrentSession(req.user.id);
    return res.status(200).json(result);
  },

  async postMessage(req, res) {
    const result = await ChatService.postMessage(req.user.id, req.body);
    return res.status(200).json(result);
  },
};

module.exports = ChatController;
