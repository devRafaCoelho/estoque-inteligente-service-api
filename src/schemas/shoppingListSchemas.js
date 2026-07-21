const Joi = require("joi");
const { UNITS } = require("./productSchemas");

const PRIORITIES = ["high", "medium", "low"];

const generateShoppingListSchema = Joi.object({
  mode: Joi.string().valid("rules").default("rules"),
});

const addShoppingItemSchema = Joi.object({
  text: Joi.string().min(1).max(500),
  name: Joi.string().min(1).max(200),
  productId: Joi.string().uuid().allow(null),
  suggestedQty: Joi.number().positive().allow(null),
  unit: Joi.string().valid(...UNITS),
  priority: Joi.string()
    .valid(...PRIORITIES)
    .default("medium"),
})
  .or("text", "name")
  .messages({
    "object.missing": 'Informe "text" (ex.: 2kg arroz) ou "name"',
  });

const updateShoppingItemSchema = Joi.object({
  name: Joi.string().min(1).max(200),
  suggestedQty: Joi.number().positive().allow(null),
  unit: Joi.string().valid(...UNITS),
  priority: Joi.string().valid(...PRIORITIES),
  checked: Joi.boolean(),
  productId: Joi.string().uuid().allow(null),
}).min(1);

const updateViewModeSchema = Joi.object({
  viewMode: Joi.string().valid("list", "paper").required(),
});

module.exports = {
  generateShoppingListSchema,
  addShoppingItemSchema,
  updateShoppingItemSchema,
  updateViewModeSchema,
};
