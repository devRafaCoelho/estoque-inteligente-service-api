const Joi = require("joi");

const CATEGORIES = [
  "cleaning",
  "hygiene",
  "produce",
  "grocery",
  "dairy",
  "beverages",
  "frozen",
  "household",
  "other",
];

const UNITS = ["un", "g", "kg", "ml", "l", "pack", "can", "bottle", "box", "other"];

const createProductSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  category: Joi.string().valid(...CATEGORIES).default("other"),
  quantity: Joi.number().min(0).default(0),
  unit: Joi.string().valid(...UNITS).default("un"),
  minQuantity: Joi.number().min(0).default(1),
  avgUnitPrice: Joi.number().min(0).allow(null),
  repurchaseDays: Joi.number().integer().min(1).allow(null),
  notes: Joi.string().allow("", null),
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(1).max(200),
  category: Joi.string().valid(...CATEGORIES),
  quantity: Joi.number().min(0),
  unit: Joi.string().valid(...UNITS),
  minQuantity: Joi.number().min(0),
  avgUnitPrice: Joi.number().min(0).allow(null),
  repurchaseDays: Joi.number().integer().min(1).allow(null),
  notes: Joi.string().allow("", null),
  active: Joi.boolean(),
}).min(1);

const consumeProductSchema = Joi.object({
  quantity: Joi.number().positive().required(),
  note: Joi.string().allow("", null),
});

const listProductsSchema = Joi.object({
  category: Joi.string().valid(...CATEGORIES),
  status: Joi.string().valid("ok", "low", "out"),
  search: Joi.string().max(200).allow(""),
  active: Joi.boolean(),
});

const createProductsBatchSchema = Joi.object({
  products: Joi.array().items(createProductSchema).min(1).max(50).required(),
});

module.exports = {
  CATEGORIES,
  UNITS,
  createProductSchema,
  updateProductSchema,
  consumeProductSchema,
  listProductsSchema,
  createProductsBatchSchema,
};
