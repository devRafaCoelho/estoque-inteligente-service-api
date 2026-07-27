/**
 * Nomes de produtos para hints do parser de IA.
 * @param {Array<{ name?: string }>} products
 * @param {number} [limit]
 */
function productHintsFrom(products = [], limit = 40) {
  return products
    .slice(0, limit)
    .map((product) => product.name)
    .filter(Boolean);
}

module.exports = { productHintsFrom };
