const Joi = require("joi");

const listNotificationsSchema = Joi.object({
  unreadOnly: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false"))
    .optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

const pushSubscriptionSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
  expirationTime: Joi.allow(null),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).required(),
});

const deletePushSubscriptionSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
});

module.exports = {
  listNotificationsSchema,
  pushSubscriptionSchema,
  deletePushSubscriptionSchema,
};
