function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

/**
 * Intervalo [from, to) do mês calendário.
 * @param {number} year
 * @param {number} month 1–12
 */
function monthRange(year, month) {
  const from = new Date(year, month - 1, 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(year, month, 1);
  to.setHours(0, 0, 0, 0);
  return { from, to };
}

module.exports = {
  startOfDay,
  startOfMonth,
  monthRange,
};
