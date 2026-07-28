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
  APP_URL: Joi.string().uri().default("http://localhost:5173"),
  // IA — Gemini via endpoint compatível OpenAI (fallback heurístico se vazio)
  AI_API_KEY: Joi.string().allow("").default(""),
  AI_BASE_URL: Joi.string()
    .allow("")
    .default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  AI_MODEL: Joi.string().allow("").default("gemini-flash-latest"),
  // Rate limit diário de IA (0 = desligado). Contadores em memória (v1).
  AI_PARSE_DAILY_LIMIT: Joi.number().integer().min(0).default(50),
  AI_CHAT_DAILY_LIMIT: Joi.number().integer().min(0).default(40),
  // Upload de cupom (parse-image)
  UPLOAD_DIR: Joi.string().default("uploads"),
  UPLOAD_MAX_MB: Joi.number().integer().min(1).max(20).default(8),
  // NF-e / NFC-e (Sprint 5) — UFs com adapter de QR
  NF_PRIORITY_STATES: Joi.string().default("SP,MG,BA"),
  NF_MOCK_COLLECTOR: Joi.boolean().truthy("true").falsy("false").default(false),
  SMTP_HOST: Joi.string().allow("").default(""),
  SMTP_PORT: Joi.number().integer().min(1).max(65535).default(587),
  SMTP_SECURE: Joi.boolean().truthy("true").falsy("false").default(false),
  SMTP_USER: Joi.string().allow("").default(""),
  SMTP_PASS: Joi.string().allow("").default(""),
  EMAIL_FROM: Joi.string().email().default("noreply@estoque-inteligente.local"),
  EMAIL_PREVIEW_DIR: Joi.string().default("tmp/email-previews"),
  VAPID_PUBLIC_KEY: Joi.string().allow("").default(""),
  VAPID_PRIVATE_KEY: Joi.string().allow("").default(""),
  VAPID_SUBJECT: Joi.string().default("mailto:noreply@estoque-inteligente.local"),
}).unknown(true);

const { value, error } = schema.validate(process.env);
if (error) {
  throw new Error(`Config inválida: ${error.message}`);
}

module.exports = value;
