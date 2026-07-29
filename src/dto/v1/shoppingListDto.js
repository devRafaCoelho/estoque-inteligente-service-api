const ShoppingListItemDto = (row) => ({
  id: row.id,
  productId: row.product_id || null,
  name: row.name,
  suggestedQty: row.suggested_qty != null ? Number(row.suggested_qty) : null,
  unit: row.unit || "un",
  priority: row.priority,
  origin: row.origin,
  checked: Boolean(row.checked),
  sortOrder: row.sort_order,
  createdAt: row.created_at,
});

const ShoppingListDto = (list, items = [], viewMode = "paper", spendEstimate = null) => ({
  id: list.id,
  title: list.title,
  status: list.status,
  generatedBy: list.generated_by || null,
  viewMode,
  createdAt: list.created_at,
  updatedAt: list.updated_at,
  completedAt: list.completed_at || null,
  items: items.map(ShoppingListItemDto),
  stats: {
    total: items.length,
    checked: items.filter((i) => i.checked).length,
    pending: items.filter((i) => !i.checked).length,
  },
  spendEstimate: spendEstimate
    ? {
        currency: spendEstimate.currency || "BRL",
        estimatedTotal: Number(spendEstimate.estimatedTotal) || 0,
        pricedItemCount: Number(spendEstimate.pricedItemCount) || 0,
        unpricedItemCount: Number(spendEstimate.unpricedItemCount) || 0,
        isPartial: Boolean(spendEstimate.isPartial),
        hasEstimate: Boolean(spendEstimate.hasEstimate),
        unpricedItems: Array.isArray(spendEstimate.unpricedItems)
          ? spendEstimate.unpricedItems.map((row) => ({
              itemId: row.itemId || null,
              productId: row.productId || null,
              name: row.name,
              quantity: row.quantity != null ? Number(row.quantity) : null,
              unit: row.unit || "un",
              canSetPrice: Boolean(row.canSetPrice),
            }))
          : [],
      }
    : null,
});

module.exports = { ShoppingListItemDto, ShoppingListDto };
