const Joi = require("joi");

const createHouseholdSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
});

const updateHouseholdSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
});

const inviteHouseholdSchema = Joi.object({
  email: Joi.string().trim().email().required(),
});

const acceptHouseholdInviteSchema = Joi.object({
  token: Joi.string().trim().min(16).required(),
});

module.exports = {
  createHouseholdSchema,
  updateHouseholdSchema,
  inviteHouseholdSchema,
  acceptHouseholdInviteSchema,
};
