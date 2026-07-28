const Joi = require("joi");

function toDigitsOrNull(value) {
  if (value == null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  return digits || null;
}

const cpfSchema = Joi.string()
  .allow(null, "")
  .custom((value, helpers) => {
    const digits = toDigitsOrNull(value);
    if (digits == null) return null;
    if (digits.length !== 11) {
      return helpers.message("CPF deve ter 11 dígitos");
    }
    return digits;
  });

const zipCodeSchema = Joi.string()
  .allow(null, "")
  .custom((value, helpers) => {
    const digits = toDigitsOrNull(value);
    if (digits == null) return null;
    if (digits.length !== 8) {
      return helpers.message("CEP deve ter 8 dígitos");
    }
    return digits;
  });

const phoneSchema = Joi.string()
  .allow(null, "")
  .custom((value, helpers) => {
    const digits = toDigitsOrNull(value);
    if (digits == null) return null;
    if (digits.length < 10 || digits.length > 13) {
      return helpers.message("Telefone inválido");
    }
    return digits;
  });

const updateMeSchema = Joi.object({
  firstName: Joi.string().min(2).max(150),
  lastName: Joi.string().min(1).max(150).allow(null, ""),
  defaultState: Joi.string().length(2).uppercase().allow(null, ""),
  avatarUrl: Joi.string().uri().allow(null, ""),
  phone: phoneSchema,
  cpf: cpfSchema,
  zipCode: zipCodeSchema,
  street: Joi.string().max(255).allow(null, ""),
  streetNumber: Joi.string().max(20).allow(null, ""),
  complement: Joi.string().max(120).allow(null, ""),
  neighborhood: Joi.string().max(120).allow(null, ""),
  city: Joi.string().max(120).allow(null, ""),
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
  pushEnabled: Joi.boolean(),
  consumptionNudgeDays: Joi.number().integer().min(1).max(30),
  quietHoursEnabled: Joi.boolean(),
  quietHoursStart: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietHoursEnd: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietHoursTimezone: Joi.string().max(60),
  shoppingListViewMode: Joi.string().valid("list", "paper"),
}).min(1);

module.exports = { updateMeSchema, changePasswordSchema, updatePreferencesSchema };
