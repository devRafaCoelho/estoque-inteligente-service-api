const IntakeService = require("../services/IntakeService");
const IntakeConfirmService = require("../services/IntakeConfirmService");

const IntakeController = {
  async parseText(req, res) {
    const intake = await IntakeService.parseNaturalLanguage(req.user.id, req.body.text);
    return res.status(201).json({ intake });
  },

  async get(req, res) {
    const intake = await IntakeService.get(req.user.id, req.params.id);
    return res.status(200).json({ intake });
  },

  async update(req, res) {
    const intake = await IntakeService.update(req.user.id, req.params.id, req.body);
    return res.status(200).json({ intake });
  },

  async confirm(req, res) {
    const result = await IntakeConfirmService.confirm(req.user.id, req.params.id, req.body);
    return res.status(200).json(result);
  },

  async cancel(req, res) {
    const intake = await IntakeService.cancel(req.user.id, req.params.id);
    return res.status(200).json({ intake });
  },
};

module.exports = IntakeController;
