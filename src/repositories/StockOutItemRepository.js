const db = require("../config/db");

const StockOutItemRepository = {
  async createMany(stockOutId, items, client = db) {
    const created = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const { rows } = await client.query(
        `INSERT INTO stock_out_items
           (stock_out_id, product_id, name, quantity, unit, confidence,
            matched_existing, available_qty, warning, excluded, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          stockOutId,
          item.productId || null,
          item.name,
          item.quantity,
          item.unit || "un",
          item.confidence ?? null,
          Boolean(item.matchedExisting),
          item.availableQty ?? null,
          item.warning || null,
          Boolean(item.excluded),
          item.sortOrder ?? i,
        ],
      );
      created.push(rows[0]);
    }
    return created;
  },

  async listByStockOut(stockOutId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM stock_out_items
       WHERE stock_out_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [stockOutId],
    );
    return rows;
  },

  async replaceAll(stockOutId, items, client = db) {
    await client.query("DELETE FROM stock_out_items WHERE stock_out_id = $1", [stockOutId]);
    return this.createMany(stockOutId, items, client);
  },
};

module.exports = StockOutItemRepository;
