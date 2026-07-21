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

const updatePreferencesSchema = Joi.object({
  notifyLowStock: Joi.boolean(),
  notifyOutOfStock: Joi.boolean(),
  notifyRepurchase: Joi.boolean(),
  notifyConsumptionNudge: Joi.boolean(),
  notifyEmailDigest: Joi.boolean(),
  consumptionNudgeDays: Joi.number().integer().min(1).max(30),
  shoppingListViewMode: Joi.string().valid("list", "paper"),
}).min(1);

module.exports = { updateMeSchema, changePasswordSchema, updatePreferencesSchema };
