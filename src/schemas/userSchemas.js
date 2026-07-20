const Joi = require("joi");

const updateMeSchema = Joi.object({
  name: Joi.string().min(2).max(150),
  defaultState: Joi.string().length(2).uppercase().allow(null, ""),
  avatarUrl: Joi.string().uri().allow(null, ""),
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().allow(null, ""),
  newPassword: Joi.string().min(8).max(128).required(),
});

module.exports = { updateMeSchema, changePasswordSchema };
