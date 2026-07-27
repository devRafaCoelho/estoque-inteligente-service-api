const fs = require("fs");
const path = require("path");
const Joi = require("joi");
const OpenAI = require("openai");
const AppError = require("../utils/AppError");
const env = require("../config/env");
const logger = require("../utils/logger");
const { CATEGORIES, UNITS } = require("../schemas/productSchemas");
const {
  parseHeuristicIntake,
  parseHeuristicConsume,
  normalizeUnit,
  guessCategory,
  looksLikeCollapsedMultiItem,
} = require("./parsers/textIntakeParser");

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
  storeName: Joi.string().max(200).allow(null, ""),
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

function validateParsedPayload(action, json, parser) {
  const storeName =
    json.storeName != null && String(json.storeName).trim()
      ? String(json.storeName).trim().slice(0, 200)
      : null;

  const normalized = {
    action,
    storeName,
    items: normalizeParsedItems(json.items || []),
  };
  const { value, error } = parsedPayloadSchema.validate(normalized, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new Error(`JSON inválido do modelo: ${error.message}`);
  }
  return { ...value, parser };
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
Aliases comuns: lata→can, garrafa→bottle, pacote/pct→pack, caixa→box, litro→l, gramas→g, quilo→kg.

Responda APENAS com JSON válido, sem markdown, neste formato:
{"action":"${action}","items":[{"name":"Arroz","quantity":2,"unit":"kg","category":"grocery","unitPrice":null,"confidence":0.9}]}

Regras:
- action deve ser "${action}"
- quantity > 0
- name curto e canônico (sem "comprei", "dê baixa em") — um produto por item
- SEPARE cada produto em um objeto do array items, mesmo sem vírgulas, ponto-e-vírgula ou "e"
- Texto de ditado por voz costuma vir contínuo; trate números e "um"/"uma"/"dois" como início de novo item
- Nunca junte vários produtos no mesmo name
- "um"/"uma" sem unidade = quantity 1 e unit "un"
- se unidade não ficar clara, use "un"
- se categoria não ficar clara, use "other"
- confidence entre 0 e 1

Exemplo (voz sem vírgulas):
Entrada: "2 kg de arroz um leite 500 gramas de feijão"
Saída: {"action":"${action}","items":[{"name":"Arroz","quantity":2,"unit":"kg","category":"grocery","unitPrice":null,"confidence":0.92},{"name":"Leite","quantity":1,"unit":"un","category":"dairy","unitPrice":null,"confidence":0.9},{"name":"Feijão","quantity":500,"unit":"g","category":"grocery","unitPrice":null,"confidence":0.92}]}
${hints}
Texto do usuário:
"""${text}"""`;
}

function buildReceiptImagePrompt(productHints = []) {
  const hints =
    productHints.length > 0
      ? `\nProdutos já cadastrados do usuário (prefira nomes próximos quando o cupom for ambíguo):\n- ${productHints.join("\n- ")}\n`
      : "";

  return `Você lê cupons fiscais / notas / listas de compra fotografados (português do Brasil) e extrai itens de estoque doméstico.

Unidades permitidas: ${UNITS.join(", ")}
Categorias permitidas: ${CATEGORIES.join(", ")}
Aliases: lata→can, garrafa→bottle, pacote/pct→pack, caixa→box, litro→l, gramas→g, quilo→kg.

Responda APENAS com JSON válido, sem markdown:
{"action":"add","storeName":"Nome do mercado ou null","items":[{"name":"Arroz","quantity":1,"unit":"kg","category":"grocery","unitPrice":12.9,"confidence":0.85}]}

Regras:
- action deve ser "add"
- Um produto por item; ignore totais, CNPJ, formas de pagamento e impostos
- name curto e legível (sem código de barras longo); se o cupom tiver descrição truncada, normalize
- quantity > 0; se só aparecer o valor unitário sem quantidade, use quantity 1 e unit "un"
- unitPrice: preço unitário em reais se legível, senão null
- se unidade não ficar clara, use "un"
- se categoria não ficar clara, use "other"
- confidence menor se a linha estiver borrada ou ambígua
- se a imagem for ilegível, não for um cupom/lista, ou não houver itens: {"action":"add","storeName":null,"items":[]}
${hints}`;
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
  return validateParsedPayload(action, json, "gemini");
}

async function parseWithFallback(action, text, productHints = []) {
  if (!text || String(text).trim().length < 3) {
    throw new AppError("Informe um texto com pelo menos 3 caracteres", 422);
  }

  const heuristic =
    action === "consume" ? parseHeuristicConsume(text) : parseHeuristicIntake(text);

  if (isAiConfigured()) {
    try {
      const llmResult = await parseWithLlm(action, text, productHints);
      if (llmResult?.items?.length) {
        const collapsed =
          llmResult.items.length === 1 &&
          looksLikeCollapsedMultiItem(llmResult.items[0], heuristic.items);

        if (collapsed) {
          logger.warn("IA colapsou vários itens; usando heurístico", {
            action,
            llmName: llmResult.items[0]?.name,
            heuristicCount: heuristic.items.length,
          });
          if (heuristic.items.length) return heuristic;
        }

        return llmResult;
      }
    } catch (err) {
      logger.warn("Falha no parse via IA; usando heurístico", {
        action,
        message: err.message,
      });
    }
  }

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

/**
 * @param {{ absolutePath: string, mimeType: string, productHints?: string[] }} opts
 */
async function parseIntakeFromImage({ absolutePath, mimeType, productHints = [] }) {
  if (!isAiConfigured()) {
    throw new AppError(
      "Leitura de cupom por foto exige IA configurada (AI_API_KEY).",
      503,
    );
  }

  const resolved = path.resolve(absolutePath);
  if (!fs.existsSync(resolved)) {
    throw new AppError("Arquivo da imagem não encontrado no servidor", 500);
  }

  const openai = getClient();
  const bytes = fs.readFileSync(resolved);
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;

  let content;
  try {
    const response = await openai.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Você extrai itens de cupom/nota para estoque doméstico. Responda somente JSON válido.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: buildReceiptImagePrompt(productHints) },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    content = response.choices?.[0]?.message?.content;
  } catch (err) {
    logger.warn("Falha na visão/OCR do cupom", {
      message: err.message,
      status: err.status,
    });
    if (err.status === 404) {
      throw new AppError(
        "Modelo de IA indisponível para visão. Verifique AI_MODEL (ex.: gemini-flash-latest).",
        503,
      );
    }
    if (err.status === 429) {
      throw new AppError(
        "Limite da IA atingido. Aguarde um pouco e tente de novo.",
        429,
      );
    }
    throw new AppError(
      "Não consegui ler a foto agora. Tente outra imagem ou use entrada por texto.",
      422,
      { cause: err.message },
    );
  }

  let json;
  try {
    json = extractJson(content);
  } catch (err) {
    logger.warn("Resposta de visão sem JSON válido", { message: err.message });
    throw new AppError(
      "Não entendi o cupom nesta foto. Tire outra (mais nítida e de perto) ou use texto.",
      422,
    );
  }

  const items = Array.isArray(json.items) ? json.items : [];
  if (!items.length) {
    throw new AppError(
      "Não encontrei itens nesta foto. Confira se é um cupom legível ou use entrada por texto.",
      422,
    );
  }

  try {
    return validateParsedPayload("add", json, "vision");
  } catch (err) {
    logger.warn("JSON de visão inválido no schema", { message: err.message });
    throw new AppError(
      "Não consegui estruturar os itens do cupom. Tente outra foto ou use texto.",
      422,
    );
  }
}

const AiParseService = {
  isConfigured: isAiConfigured,

  async parseIntake(text, { productHints = [] } = {}) {
    return parseWithFallback("add", text, productHints);
  },

  async parseConsume(text, { productHints = [] } = {}) {
    return parseWithFallback("consume", text, productHints);
  },

  async parseIntakeFromImage(opts) {
    return parseIntakeFromImage(opts);
  },
};

module.exports = AiParseService;
