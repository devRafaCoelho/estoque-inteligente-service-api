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

const ShoppingListDto = (list, items = [], viewMode = "list") => ({
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
});

module.exports = { ShoppingListItemDto, ShoppingListDto };
