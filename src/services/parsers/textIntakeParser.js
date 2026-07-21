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
  return Number(String(raw).replace(",", "."));
}

function cleanProductName(nameRaw) {
  return titleCaseName(String(nameRaw).replace(/^(de|do|da|dos|das)\s+/i, ""));
}

/**
 * Parser heurístico local (Etapa 1).
 * Exemplos aceitos:
 * - "2kg arroz, 1 leite, 500g feijão"
 * - "comprei 2 kg de arroz e 1 litro de leite"
 */
function parseHeuristicIntake(text) {
  const cleaned = String(text)
    .replace(/\bcomprei\b/gi, "")
    .trim();

  const chunks = cleaned
    .split(/\n|;|,(?![^()]*\))|\se\s/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const qtyFirst = new RegExp(
    `^(\\d+(?:[.,]\\d+)?)\\s*(?:(${UNIT_TOKEN})\\b\\s*)?(?:de\\s+)?(.+)$`,
    "i",
  );
  const nameFirst = new RegExp(
    `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_TOKEN})?$`,
    "i",
  );

  const items = [];

  for (const chunk of chunks) {
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
      if (nameOnly.length < 2) continue;
      items.push({
        name: titleCaseName(nameOnly),
        quantity: 1,
        unit: "un",
        category: guessCategory(nameOnly),
        unitPrice: null,
        confidence: 0.55,
      });
      continue;
    }

    const quantity = parseQuantity(quantityRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const name = cleanProductName(nameRaw);
    if (name.length < 2) continue;

    items.push({
      name,
      quantity,
      unit: normalizeUnit(unitRaw),
      category: guessCategory(name),
      unitPrice: null,
      confidence: unitRaw ? 0.8 : 0.65,
    });
  }

  return {
    action: "add",
    parser: "heuristic",
    items,
  };
}

module.exports = {
  UNITS,
  normalizeUnit,
  guessCategory,
  parseHeuristicIntake,
};
