const Joi = require("joi");
const OpenAI = require("openai");
const AppError = require("../utils/AppError");
const env = require("../config/env");
const logger = require("../utils/logger");
const { CATEGORIES, UNITS } = require("../schemas/productSchemas");
const { parseHeuristicIntake, normalizeUnit, guessCategory } = require("./parsers/textIntakeParser");

const parsedItemSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string()
    .valid(...UNITS)
    .default("un"),
  category: Joi.string()
    .valid(...CATEGORIES)
    .default("other"),
  unitPrice: Joi.number().min(0).allow(null),
  confidence: Joi.number().min(0).max(1).default(0.75),
});

const parsedPayloadSchema = Joi.object({
  action: Joi.string().valid("add", "consume").required(),
  items: Joi.array().items(parsedItemSchema).min(1).required(),
});

let client;

function isAiConfigured() {
  return Boolean(env.AI_API_KEY);
}

function getClient() {
  if (!isAiConfigured()) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
    });
  }
  return client;
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Resposta sem JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeParsedItems(items) {
  return items.map((item) => ({
    name: String(item.name).trim(),
    quantity: Number(item.quantity),
    unit: normalizeUnit(item.unit) || "un",
    category: CATEGORIES.includes(item.category) ? item.category : guessCategory(item.name),
    unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
    confidence: item.confidence != null ? Number(item.confidence) : 0.75,
  }));
}

function buildPrompt(action, text, productHints = []) {
  const actionLabel = action === "consume" ? "consumo/baixa de estoque" : "compra/entrada de estoque";
  const hints =
    productHints.length > 0
      ? `\nProdutos já cadastrados do usuário (prefira nomes próximos):\n- ${productHints.join("\n- ")}\n`
      : "";

  return `Você extrai itens de estoque doméstico a partir de texto em português do Brasil.
Tarefa: interpretar uma ${actionLabel}.

Unidades permitidas: ${UNITS.join(", ")}
Categorias permitidas: ${CATEGORIES.join(", ")}
Aliases comuns: lata→can, garrafa→bottle, pacote/pct→pack, caixa→box, litro→l.

Responda APENAS com JSON válido, sem markdown, neste formato:
{"action":"${action}","items":[{"name":"Arroz","quantity":2,"unit":"kg","category":"grocery","unitPrice":null,"confidence":0.9}]}

Regras:
- action deve ser "${action}"
- quantity > 0
- name curto e canônico (sem "comprei", "dê baixa em")
- se unidade não ficar clara, use "un"
- se categoria não ficar clara, use "other"
- confidence entre 0 e 1
${hints}
Texto do usuário:
"""${text}"""`;
}

async function parseWithLlm(action, text, productHints = []) {
  const openai = getClient();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: env.AI_MODEL,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: "Você é um extrator de itens de estoque. Responda somente JSON válido.",
      },
      { role: "user", content: buildPrompt(action, text, productHints) },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  const json = extractJson(content);
  const normalized = {
    action,
    items: normalizeParsedItems(json.items || []),
  };
  const { value, error } = parsedPayloadSchema.validate(normalized, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new Error(`JSON inválido do modelo: ${error.message}`);
  }
  return { ...value, parser: "gemini" };
}

/**
 * Parser heurístico de baixa (espelha intake, remove verbos de consumo).
 */
function parseHeuristicConsume(text) {
  const cleaned = String(text)
    .replace(/\b(dê|de|dar|dei|usei|consumi|baixe|baixa|baixar)\b/gi, " ")
    .replace(/\bem\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parsed = parseHeuristicIntake(cleaned || text);
  return {
    action: "consume",
    parser: "heuristic",
    items: parsed.items,
  };
}

async function parseWithFallback(action, text, productHints = []) {
  if (!text || String(text).trim().length < 3) {
    throw new AppError("Informe um texto com pelo menos 3 caracteres", 422);
  }

  if (isAiConfigured()) {
    try {
      const llmResult = await parseWithLlm(action, text, productHints);
      if (llmResult?.items?.length) return llmResult;
    } catch (err) {
      logger.warn("Falha no parse via IA; usando heurístico", {
        action,
        message: err.message,
      });
    }
  }

  const heuristic =
    action === "consume" ? parseHeuristicConsume(text) : parseHeuristicIntake(text);

  if (!heuristic.items.length) {
    throw new AppError(
      action === "consume"
        ? 'Não consegui identificar itens. Tente: "dê baixa em 1 leite, 200g de queijo"'
        : 'Não consegui identificar itens. Tente: "2kg arroz, 1 leite, 500g feijão"',
      422,
    );
  }

  return heuristic;
}

const AiParseService = {
  isConfigured: isAiConfigured,

  async parseIntake(text, { productHints = [] } = {}) {
    return parseWithFallback("add", text, productHints);
  },

  async parseConsume(text, { productHints = [] } = {}) {
    return parseWithFallback("consume", text, productHints);
  },
};

module.exports = AiParseService;
