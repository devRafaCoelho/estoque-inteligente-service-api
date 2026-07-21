const IntakeItemDto = (row) => ({
  id: row.id,
  productId: row.product_id || null,
  name: row.name,
  quantity: Number(row.quantity),
  unit: row.unit,
  category: row.category || null,
  unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
  confidence: row.confidence != null ? Number(row.confidence) : null,
  matchedExisting: Boolean(row.matched_existing),
  excluded: Boolean(row.excluded),
  sortOrder: row.sort_order,
});

const IntakeDetailDto = (intake, items = []) => ({
  id: intake.id,
  source: intake.source,
  status: intake.status,
  rawInput: intake.raw_input || null,
  stateCode: intake.state_code || null,
  storeName: intake.raw_payload?.storeName || null,
  errorMessage: intake.error_message || null,
  parser: intake.raw_payload?.parser || null,
  confirmedAt: intake.confirmed_at || null,
  createdAt: intake.created_at,
  updatedAt: intake.updated_at,
  items: items.map(IntakeItemDto),
});

module.exports = { IntakeItemDto, IntakeDetailDto };
