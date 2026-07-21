const Joi = require("joi");

const listNotificationsSchema = Joi.object({
  unreadOnly: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false"))
    .optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = { listNotificationsSchema };
