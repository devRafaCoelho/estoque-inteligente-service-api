const IntakeService = require("../services/IntakeService");
const IntakeConfirmService = require("../services/IntakeConfirmService");

const IntakeController = {
  async list(req, res) {
    const intakes = await IntakeService.list(req.user.id, req.query);
    return res.status(200).json({ intakes });
  },

  async parseText(req, res) {
    const intake = await IntakeService.parseNaturalLanguage(req.user.id, req.body.text);
    return res.status(201).json({ intake });
  },

  async parseImage(req, res) {
    const intake = await IntakeService.parseReceiptPhoto(
      req.user.id,
      req.file,
      req.receiptRelativePath || null,
    );
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

  async clearDrafts(req, res) {
    const result = await IntakeService.clearDrafts(req.user.id);
    return res.status(200).json(result);
  },
};

module.exports = IntakeController;
