/**
 * Estimativa de gasto da lista a partir de qty sugerida × preço unitário registrado.
 * Não busca preço na web; itens sem preço entram como "sem preço" (total parcial).
 */

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function productKey(item) {
  return item.product_id || item.productId || null;
}

function suggestedQtyOf(item) {
  const qty = Number(item.suggested_qty ?? item.suggestedQty);
  return Number.isFinite(qty) && qty > 0 ? qty : null;
}

function unitPriceOf(product) {
  if (!product) return null;
  const price = Number(product.avg_unit_price ?? product.avgUnitPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * @param {Array<object>} items — rows/DTOs da lista
 * @param {Map<string, object>|Record<string, object>} productsById
 * @param {{ onlyPending?: boolean }} [options]
 */
function estimateShoppingListSpend(items = [], productsById = new Map(), options = {}) {
  const onlyPending = options.onlyPending !== false;
  const getProduct = (id) => {
    if (!id) return null;
    if (productsById instanceof Map) return productsById.get(id) || null;
    return productsById[id] || null;
  };

  let estimatedTotal = 0;
  let pricedItemCount = 0;
  let unpricedItemCount = 0;
  const considered = [];
  const unpricedItems = [];
  const seenUnpricedProducts = new Set();

  for (const item of items || []) {
    const checked = Boolean(item.checked);
    if (onlyPending && checked) continue;

    const qty = suggestedQtyOf(item);
    const productId = productKey(item);
    const product = getProduct(productId);
    const unitPrice = unitPriceOf(product);
    const unit = item.unit || product?.unit || "un";
    const name = item.name || product?.name || "Item";

    if (qty == null) continue;

    if (unitPrice == null) {
      unpricedItemCount += 1;
      const dedupeKey = productId || `name:${String(name).toLowerCase()}`;
      if (!seenUnpricedProducts.has(dedupeKey)) {
        seenUnpricedProducts.add(dedupeKey);
        unpricedItems.push({
          itemId: item.id || null,
          productId,
          name,
          quantity: qty,
          unit,
          canSetPrice: Boolean(productId),
        });
      }
      continue;
    }

    const lineTotal = roundMoney(qty * unitPrice);
    estimatedTotal = roundMoney(estimatedTotal + lineTotal);
    pricedItemCount += 1;
    considered.push({
      itemId: item.id || null,
      productId,
      name,
      quantity: qty,
      unit,
      unitPrice,
      lineTotal,
    });
  }

  return {
    currency: "BRL",
    estimatedTotal,
    pricedItemCount,
    unpricedItemCount,
    isPartial: pricedItemCount > 0 && unpricedItemCount > 0,
    hasEstimate: pricedItemCount > 0,
    lines: considered,
    unpricedItems,
  };
}

module.exports = {
  estimateShoppingListSpend,
};
