/**
 * Pluralização simples em pt-BR para mensagens ao usuário.
 * @param {number} count
 * @param {string} singular
 * @param {string} plural
 */
function ptCountLabel(count, singular, plural) {
  const n = Number(count) || 0;
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

function itemCountLabel(count) {
  return ptCountLabel(count, "item", "itens");
}

function pendingCountLabel(count) {
  return ptCountLabel(count, "pendente", "pendentes");
}

module.exports = {
  ptCountLabel,
  itemCountLabel,
  pendingCountLabel,
};
