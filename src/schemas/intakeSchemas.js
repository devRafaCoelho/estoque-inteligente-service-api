const Joi = require("joi");
const { CATEGORIES, UNITS } = require("./productSchemas");

const parseNaturalLanguageSchema = Joi.object({
  text: Joi.string().min(3).max(4000).required(),
});

const intakeItemSchema = Joi.object({
  id: Joi.string().uuid().allow(null),
  productId: Joi.string().uuid().allow(null),
  name: Joi.string().min(1).max(200).required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string()
    .valid(...UNITS)
    .required(),
  category: Joi.string()
    .valid(...CATEGORIES)
    .allow(null),
  unitPrice: Joi.number().min(0).allow(null),
  excluded: Joi.boolean().default(false),
  confidence: Joi.number().min(0).max(1).allow(null),
  matchedExisting: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0),
});

const updateIntakeSchema = Joi.object({
  storeName: Joi.string().max(200).allow("", null),
  items: Joi.array().items(intakeItemSchema).min(1).required(),
});

const confirmIntakeSchema = Joi.object({
  storeName: Joi.string().max(200).allow("", null),
  purchasedAt: Joi.date().iso().allow(null),
  items: Joi.array().items(intakeItemSchema).min(1).required(),
});

module.exports = {
  parseNaturalLanguageSchema,
  updateIntakeSchema,
  confirmIntakeSchema,
};
