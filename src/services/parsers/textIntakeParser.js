const UNITS = ["un", "g", "kg", "ml", "l", "pack", "can", "bottle", "box", "other"];

const UNIT_ALIASES = {
  un: "un",
  und: "un",
  unidade: "un",
  unidades: "un",
  u: "un",
  g: "g",
  gr: "g",
  grama: "g",
  gramas: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  quilo: "kg",
  quilos: "kg",
  ml: "ml",
  l: "l",
  lt: "l",
  litro: "l",
  litros: "l",
  pack: "pack",
  pct: "pack",
  pacote: "pack",
  pacotes: "pack",
  can: "can",
  lata: "can",
  latas: "can",
  bottle: "bottle",
  garrafa: "bottle",
  garrafas: "bottle",
  box: "box",
  caixa: "box",
  caixas: "box",
};

// Ordem: tokens longos primeiro para o regex não capturar "l" de "leite"/"litro"
const UNIT_TOKEN =
  "quilos?|kilos?|quilo|kilo|kg|gramas?|grama|gr|g|mililitros?|ml|litros?|litro|lt|l|unidades?|unidade|und|un|u|pacotes?|pacote|pack|pct|latas?|lata|garrafas?|garrafa|caixas?|caixa|can|bottle|box";

const SPOKEN_QTY_TOKEN =
  "uma|umas|uns|um|duas|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|meia|meio";

const SPOKEN_QUANTITIES = {
  um: 1,
  uma: 1,
  uns: 1,
  umas: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  meio: 0.5,
  meia: 0.5,
};

const CATEGORY_HINTS = [
  { category: "dairy", words: ["leite", "queijo", "iogurte", "manteiga", "requeijão"] },
  { category: "beverages", words: ["água", "agua", "refrigerante", "suco", "cerveja", "café", "cafe"] },
  { category: "cleaning", words: ["detergente", "sabão", "sabao", "amaciante", "desinfetante", "água sanitária", "agua sanitaria"] },
  { category: "hygiene", words: ["shampoo", "sabonete", "papel higiênico", "papel higienico", "creme dental"] },
  { category: "produce", words: ["banana", "maçã", "maca", "tomate", "alface", "cenoura", "fruta"] },
  { category: "frozen", words: ["congelado", "pizza", "nugget"] },
  { category: "grocery", words: ["arroz", "feijão", "feijao", "açúcar", "acucar", "sal", "macarrão", "macarrao", "óleo", "oleo", "azeite", "farinha"] },
];

function normalizeUnit(raw) {
  if (!raw) return "un";
  const key = String(raw).toLowerCase().trim();
  return UNIT_ALIASES[key] || (UNITS.includes(key) ? key : "other");
}

function guessCategory(name) {
  const lower = name.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => lower.includes(word))) return hint.category;
  }
  return "other";
}

function titleCaseName(name) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

function parseQuantity(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (Object.prototype.hasOwnProperty.call(SPOKEN_QUANTITIES, key)) {
    return SPOKEN_QUANTITIES[key];
  }
  // chave com acento original
  const rawKey = String(raw || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(SPOKEN_QUANTITIES, rawKey)) {
    return SPOKEN_QUANTITIES[rawKey];
  }
  return Number(String(raw).replace(",", "."));
}

function cleanProductName(nameRaw) {
  return titleCaseName(String(nameRaw).replace(/^(de|do|da|dos|das)\s+/i, ""));
}

/**
 * Quebra texto contínuo (voz sem vírgulas) em candidatos a item.
 * Ex.: "2 kg de arroz um leite 500 gramas de feijão"
 */
function splitItemChunks(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const softSplit = cleaned
    .split(/\n|;|,(?![^()]*\))|\se\s/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const boundary = new RegExp(
    `(?:^|\\s)(?=((?:\\d+(?:[.,]\\d+)?)|(?:${SPOKEN_QTY_TOKEN}))(?:\\s*(?:${UNIT_TOKEN})\\b)?(?:\\s+de)?\\s+[A-Za-zÀ-ú])`,
    "gi",
  );

  const chunks = [];
  for (const part of softSplit) {
    const starts = [];
    boundary.lastIndex = 0;
    let match = boundary.exec(part);
    while (match) {
      const idx = match[0].startsWith(" ") ? match.index + 1 : match.index;
      if (starts.length === 0 || starts[starts.length - 1] !== idx) {
        starts.push(idx);
      }
      if (match.index === boundary.lastIndex) boundary.lastIndex += 1;
      match = boundary.exec(part);
    }

    if (starts.length <= 1) {
      chunks.push(part);
      continue;
    }

    for (let i = 0; i < starts.length; i += 1) {
      const from = starts[i];
      const to = i + 1 < starts.length ? starts[i + 1] : part.length;
      const slice = part.slice(from, to).trim();
      if (slice) chunks.push(slice);
    }
  }

  return chunks;
}

function parseChunk(chunk) {
  const qtyFirst = new RegExp(
    `^((?:\\d+(?:[.,]\\d+)?)|(?:${SPOKEN_QTY_TOKEN}))\\s*(?:(${UNIT_TOKEN})\\b\\s*)?(?:de\\s+)?(.+)$`,
    "i",
  );
  const nameFirst = new RegExp(
    `^(.+?)\\s+((?:\\d+(?:[.,]\\d+)?)|(?:${SPOKEN_QTY_TOKEN}))\\s*(${UNIT_TOKEN})?$`,
    "i",
  );

  let match = chunk.match(qtyFirst);
  let quantityRaw;
  let unitRaw;
  let nameRaw;

  if (match) {
    [, quantityRaw, unitRaw, nameRaw] = match;
  } else {
    match = chunk.match(nameFirst);
    if (match) {
      [, nameRaw, quantityRaw, unitRaw] = match;
    }
  }

  if (!match) {
    const nameOnly = chunk.replace(/^(um|uma|uns|umas)\s+/i, "").trim();
    if (nameOnly.length < 2) return null;
    return {
      name: titleCaseName(nameOnly),
      quantity: 1,
      unit: "un",
      category: guessCategory(nameOnly),
      unitPrice: null,
      confidence: 0.55,
    };
  }

  const quantity = parseQuantity(quantityRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const name = cleanProductName(nameRaw);
  if (name.length < 2) return null;

  return {
    name,
    quantity,
    unit: normalizeUnit(unitRaw),
    category: guessCategory(name),
    unitPrice: null,
    confidence: unitRaw ? 0.8 : 0.65,
  };
}

/**
 * Remove acentos para matching de palavras (\\b do JS não trata bem "ê"/"ç").
 */
function foldAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Remove verbos/preâmbulos de consumo antes do parse de baixa.
 * Ex.: "dê baixa em 1kg de arroz tipo 1" → "1kg de arroz tipo 1"
 */
function stripConsumePreamble(text) {
  let cleaned = foldAccents(String(text || ""));

  cleaned = cleaned
    .replace(
      /(?:^|[\s,;])(?:por\s+favor[,.]?\s*)?(?:(?:de|dar|dei|vamos)\s+)?(?:baixa|baixar|baixe)(?:\s+em)?\b/gi,
      " ",
    )
    .replace(/\b(usei|consumi|consumir|consumo)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // sobra "de/em" soltos no início após remover "dê baixa em"
  cleaned = cleaned.replace(/^(?:de|em|do|da|dos|das)\s+/i, "").trim();

  return cleaned || String(text || "").trim();
}

/**
 * Parser heurístico local (Etapa 1).
 * Exemplos aceitos:
 * - "2kg arroz, 1 leite, 500g feijão"
 * - "comprei 2 kg de arroz e 1 litro de leite"
 * - "2 kg de arroz um leite 500 gramas de feijão" (voz sem vírgulas)
 */
function parseHeuristicIntake(text) {
  const cleaned = String(text)
    .replace(/\bcomprei\b/gi, "")
    .trim();

  const chunks = splitItemChunks(cleaned);
  const items = [];

  for (const chunk of chunks) {
    const item = parseChunk(chunk);
    if (item) items.push(item);
  }

  return {
    action: "add",
    parser: "heuristic",
    items,
  };
}

/**
 * Parser heurístico de baixa (espelha intake, remove verbos de consumo).
 */
function parseHeuristicConsume(text) {
  const cleaned = stripConsumePreamble(text);
  const parsed = parseHeuristicIntake(cleaned || text);
  return {
    action: "consume",
    parser: "heuristic",
    items: parsed.items,
  };
}

/**
 * Indica se o LLM provavelmente colapsou vários itens em um nome só.
 */
function looksLikeCollapsedMultiItem(item, heuristicItems = []) {
  if (!item || heuristicItems.length < 2) return false;
  const name = String(item.name || "").toLowerCase();
  if (!name) return false;

  const hits = heuristicItems.filter((candidate) => {
    const token = String(candidate.name || "")
      .toLowerCase()
      .split(/\s+/)[0];
    return token && name.includes(token);
  });

  if (hits.length >= 2) return true;

  // nome longo com outra quantidade no meio
  return /\d/.test(name) || new RegExp(`\\b(?:${SPOKEN_QTY_TOKEN})\\b`, "i").test(name);
}

module.exports = {
  UNITS,
  normalizeUnit,
  guessCategory,
  parseHeuristicIntake,
  parseHeuristicConsume,
  stripConsumePreamble,
  splitItemChunks,
  looksLikeCollapsedMultiItem,
};
