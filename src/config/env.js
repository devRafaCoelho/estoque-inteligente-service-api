const Joi = require("joi");

const schema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default("7d"),
  CORS_ORIGIN: Joi.string().default("http://localhost:5173"),
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "http", "debug")
    .default("info"),
  GOOGLE_CLIENT_ID: Joi.string().allow("").default(""),
  APPLE_CLIENT_ID: Joi.string().allow("").default(""),
  APPLE_TEAM_ID: Joi.string().allow("").default(""),
  APPLE_KEY_ID: Joi.string().allow("").default(""),
  // IA — Gemini via endpoint compatível OpenAI (fallback heurístico se vazio)
  AI_API_KEY: Joi.string().allow("").default(""),
  AI_BASE_URL: Joi.string()
    .allow("")
    .default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  AI_MODEL: Joi.string().allow("").default("gemini-2.5-flash"),
  // Rate limit diário de IA (0 = desligado). Contadores em memória (v1).
  AI_PARSE_DAILY_LIMIT: Joi.number().integer().min(0).default(50),
  AI_CHAT_DAILY_LIMIT: Joi.number().integer().min(0).default(40),
}).unknown(true);

const { value, error } = schema.validate(process.env);
if (error) {
  throw new Error(`Config inválida: ${error.message}`);
}

module.exports = value;
