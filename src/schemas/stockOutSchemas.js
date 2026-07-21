const Joi = require("joi");
const { UNITS } = require("./productSchemas");

const parseConsumeTextSchema = Joi.object({
  text: Joi.string().min(3).max(4000).required(),
});

const stockOutItemSchema = Joi.object({
  id: Joi.string().uuid().allow(null),
  productId: Joi.string().uuid().allow(null),
  name: Joi.string().min(1).max(200).required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string()
    .valid(...UNITS)
    .required(),
  excluded: Joi.boolean().default(false),
  allowZero: Joi.boolean().default(false),
  confidence: Joi.number().min(0).max(1).allow(null),
  matchedExisting: Joi.boolean(),
  availableQty: Joi.number().min(0).allow(null),
  warning: Joi.string().allow(null, ""),
  sortOrder: Joi.number().integer().min(0),
});

const updateStockOutSchema = Joi.object({
  items: Joi.array().items(stockOutItemSchema).min(1).required(),
});

const confirmStockOutSchema = Joi.object({
  items: Joi.array().items(stockOutItemSchema).min(1).required(),
});

module.exports = {
  parseConsumeTextSchema,
  updateStockOutSchema,
  confirmStockOutSchema,
};
