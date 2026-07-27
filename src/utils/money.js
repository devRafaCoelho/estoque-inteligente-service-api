/**
 * @param {unknown} value
 * @returns {string} ex.: 12,50
 */
function formatBRLAmount(value) {
  return Number(value || 0)
    .toFixed(2)
    .replace(".", ",");
}

/**
 * @param {unknown} quantity
 * @param {unknown} unitPrice
 * @returns {number|null}
 */
function lineTotal(quantity, unitPrice) {
  if (unitPrice == null || unitPrice === "") return null;
  const qty = Number(quantity);
  const price = Number(unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
  return Math.round(qty * price * 100) / 100;
}

module.exports = {
  formatBRLAmount,
  lineTotal,
};
