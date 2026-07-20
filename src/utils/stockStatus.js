function stockStatus(quantity, minQuantity) {
  const qty = Number(quantity);
  const min = Number(minQuantity);
  if (qty <= 0) return "out";
  if (qty <= min) return "low";
  return "ok";
}

module.exports = stockStatus;
