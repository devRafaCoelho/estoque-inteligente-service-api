const Joi = require("joi");

const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(150),
  lastName: Joi.string().min(1).max(150).allow(null, ""),
  name: Joi.string().min(2).max(150),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  defaultState: Joi.string().length(2).uppercase().allow(null, ""),
})
  .or("firstName", "name")
  .messages({
    "object.missing": "Informe o nome",
  });

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const oauthTokenSchema = Joi.object({
  idToken: Joi.string().required(),
  fullName: Joi.string().max(150).allow(null, ""),
});

module.exports = { registerSchema, loginSchema, oauthTokenSchema };
