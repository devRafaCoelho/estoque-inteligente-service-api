const Joi = require("joi");

const postChatMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
  sessionId: Joi.string().uuid().optional().allow(null),
});

module.exports = {
  postChatMessageSchema,
};
