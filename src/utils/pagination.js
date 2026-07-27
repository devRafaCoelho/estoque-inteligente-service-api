/**
 * @param {unknown} value
 * @param {{ min?: number, max?: number, fallback?: number }} [options]
 */
function clampLimit(value, { min = 1, max = 100, fallback = 50 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

module.exports = { clampLimit };
