const HouseholdService = require("../services/HouseholdService");

const HouseholdController = {
  async create(req, res) {
    const result = await HouseholdService.create(req.user.id, req.body);
    return res.status(201).json(result);
  },

  async update(req, res) {
    const result = await HouseholdService.update(
      req.user.id,
      req.params.id,
      req.body,
    );
    return res.status(200).json(result);
  },

  async getMine(req, res) {
    const result = await HouseholdService.getMine(req.user.id);
    return res.status(200).json(result);
  },

  async listMembers(req, res) {
    const result = await HouseholdService.listMembers(req.user.id, req.params.id);
    return res.status(200).json(result);
  },

  async invite(req, res) {
    const result = await HouseholdService.invite(req.user.id, req.params.id, req.body);
    return res.status(201).json(result);
  },

  async acceptInvite(req, res) {
    const result = await HouseholdService.acceptInvite(req.user.id, req.body);
    return res.status(200).json(result);
  },

  async removeMember(req, res) {
    const result = await HouseholdService.removeMember(
      req.user.id,
      req.params.id,
      req.params.userId,
    );
    return res.status(200).json(result);
  },

  async listInvites(req, res) {
    const result = await HouseholdService.listInvites(req.user.id, req.params.id);
    return res.status(200).json(result);
  },

  async revokeInvite(req, res) {
    const result = await HouseholdService.revokeInvite(
      req.user.id,
      req.params.id,
      req.params.inviteId,
    );
    return res.status(200).json(result);
  },

  async leave(req, res) {
    const result = await HouseholdService.leave(req.user.id, req.params.id);
    return res.status(200).json(result);
  },
};

module.exports = HouseholdController;
