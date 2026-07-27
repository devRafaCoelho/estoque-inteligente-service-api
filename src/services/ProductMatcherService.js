const ProductRepository = require("../repositories/ProductRepository");

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove ruído de quantidade/unidade colado no nome (ex.: "1kg arroz tipo").
 */
function stripQtyNoise(name) {
  return normalizeName(name)
    .replace(
      /(?:^|\s)\d+(?:[.,]\d+)?\s*(?:quilos?|kilos?|kg|gramas?|gr|g|mililitros?|ml|litros?|litro|lt|l|unidades?|und|un|u|pacotes?|pct|pack|latas?|garrafas?|caixas?)?\b/gi,
      " ",
    )
    .replace(/\b(de|do|da|dos|das|em|dei|dar|baixa|baixar|baixe|usei|consumi)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(itemKey, productName) {
  const pname = normalizeName(productName);
  if (!itemKey || !pname) return 0;
  if (pname === itemKey) return 1000 + pname.length;
  if (pname.includes(itemKey) || itemKey.includes(pname)) {
    return 500 + Math.min(pname.length, itemKey.length);
  }

  const itemTokens = itemKey.split(" ").filter((t) => t.length >= 2);
  const productTokens = new Set(pname.split(" ").filter(Boolean));
  if (!itemTokens.length) return 0;

  let hits = 0;
  for (const token of itemTokens) {
    if (productTokens.has(token) || pname.includes(token)) hits += 1;
  }
  if (hits === 0) return 0;
  // exige pelo menos um token "forte" (>= 4) ou cobertura alta
  const strongHit = itemTokens.some(
    (token) => token.length >= 4 && (productTokens.has(token) || pname.includes(token)),
  );
  if (!strongHit && hits / itemTokens.length < 0.6) return 0;
  return 100 + hits * 20 + pname.length;
}

const ProductMatcherService = {
  /**
   * Matching (Etapa 1+): igualdade, contains e tokens; prefere nome mais específico.
   */
  async matchItems(userId, items, client) {
    const products = await ProductRepository.list(userId, { active: true }, client);
    const byExact = new Map(products.map((p) => [normalizeName(p.name), p]));

    return items.map((item) => {
      const key = normalizeName(item.name);
      const keyClean = stripQtyNoise(item.name);
      let product = byExact.get(key) || byExact.get(keyClean) || null;

      if (!product) {
        let best = null;
        let bestScore = 0;
        for (const candidate of products) {
          const score = Math.max(
            scoreMatch(key, candidate.name),
            scoreMatch(keyClean, candidate.name),
          );
          if (score > bestScore) {
            bestScore = score;
            best = candidate;
          }
        }
        product = bestScore > 0 ? best : null;
      }

      if (!product) {
        return {
          ...item,
          productId: null,
          matchedExisting: false,
        };
      }

      return {
        ...item,
        productId: product.id,
        matchedExisting: true,
        unit: item.unit || product.unit,
        category: item.category || product.category,
      };
    });
  },
};

module.exports = ProductMatcherService;
