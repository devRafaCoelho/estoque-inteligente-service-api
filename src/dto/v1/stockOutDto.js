const StockOutItemDto = (row) => ({
  id: row.id,
  productId: row.product_id || null,
  name: row.name,
  quantity: Number(row.quantity),
  unit: row.unit,
  confidence: row.confidence != null ? Number(row.confidence) : null,
  matchedExisting: Boolean(row.matched_existing),
  availableQty: row.available_qty != null ? Number(row.available_qty) : null,
  warning: row.warning || null,
  excluded: Boolean(row.excluded),
  sortOrder: row.sort_order,
});

const StockOutDetailDto = (stockOut, items = []) => ({
  id: stockOut.id,
  source: stockOut.source,
  status: stockOut.status,
  rawInput: stockOut.raw_input || null,
  parser: stockOut.raw_payload?.parser || null,
  errorMessage: stockOut.error_message || null,
  confirmedAt: stockOut.confirmed_at || null,
  createdAt: stockOut.created_at,
  updatedAt: stockOut.updated_at,
  items: items.map(StockOutItemDto),
});

module.exports = { StockOutItemDto, StockOutDetailDto };
