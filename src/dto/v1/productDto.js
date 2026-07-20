const stockStatus = require("../../utils/stockStatus");

const ProductListDto = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  quantity: Number(row.quantity),
  unit: row.unit,
  minQuantity: Number(row.min_quantity),
  stockStatus: stockStatus(row.quantity, row.min_quantity),
  avgUnitPrice: row.avg_unit_price != null ? Number(row.avg_unit_price) : null,
  lastPurchasedAt: row.last_purchased_at || null,
  lastConsumedAt: row.last_consumed_at || null,
  avgWeeklyUsage: row.avg_weekly_usage != null ? Number(row.avg_weekly_usage) : null,
  repurchaseDays: row.repurchase_days || null,
  active: row.active,
});

const MovementDto = (row) => ({
  id: row.id,
  type: row.type,
  quantity: Number(row.quantity),
  unit: row.unit,
  quantityBefore: Number(row.quantity_before),
  quantityAfter: Number(row.quantity_after),
  note: row.note || null,
  createdAt: row.created_at,
});

const ProductDetailDto = (row, movements = []) => ({
  ...ProductListDto(row),
  notes: row.notes || null,
  consumptionCycleDays: row.consumption_cycle_days || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  movements: movements.map(MovementDto),
});

module.exports = { ProductListDto, ProductDetailDto, MovementDto };
