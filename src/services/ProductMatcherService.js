const ProductRepository = require("../repositories/ProductRepository");

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const ProductMatcherService = {
  /**
   * Matching simples (Etapa 1): igualdade exata case-insensitive + contains.
   */
  async matchItems(userId, items, client) {
    const products = await ProductRepository.list(userId, { active: true }, client);
    const byExact = new Map(products.map((p) => [normalizeName(p.name), p]));

    return items.map((item) => {
      const key = normalizeName(item.name);
      let product = byExact.get(key) || null;

      if (!product) {
        product =
          products.find((p) => {
            const pname = normalizeName(p.name);
            return pname.includes(key) || key.includes(pname);
          }) || null;
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
