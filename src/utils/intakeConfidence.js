/**
 * Flags de confiança de itens de entrada (mesmo eixo 0–1 do AiParseService).
 * Heurístico: 0.55 (só nome) / 0.65 (sem unidade) → low; 0.8+ → ok.
 */

const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * @param {unknown} confidence
 * @returns {number|null}
 */
function normalizeConfidence(confidence) {
  if (confidence == null || confidence === "") return null;
  const value = Number(confidence);
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} confidence
 * @returns {boolean}
 */
function isLowConfidence(confidence) {
  const value = normalizeConfidence(confidence);
  return value != null && value < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * Marca item do draft com flag derivada (não altera o valor persistido).
 * @param {object} item
 */
function flagIntakeItemConfidence(item = {}) {
  const confidence = normalizeConfidence(item.confidence);
  return {
    ...item,
    confidence,
    lowConfidence: isLowConfidence(confidence),
  };
}

/**
 * @param {Array<object>} items
 */
function summarizeIntakeConfidence(items = []) {
  const flagged = (items || []).map(flagIntakeItemConfidence);
  const lowConfidenceCount = flagged.filter((item) => item.lowConfidence).length;
  return {
    items: flagged,
    lowConfidenceCount,
    hasLowConfidenceItems: lowConfidenceCount > 0,
  };
}

module.exports = {
  LOW_CONFIDENCE_THRESHOLD,
  normalizeConfidence,
  isLowConfidence,
  flagIntakeItemConfidence,
  summarizeIntakeConfidence,
};
