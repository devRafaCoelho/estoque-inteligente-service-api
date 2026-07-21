const db = require("../config/db");

const StockIntakeItemRepository = {
  async createMany(intakeId, items, client = db) {
    const created = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const { rows } = await client.query(
        `INSERT INTO stock_intake_items
           (intake_id, product_id, name, quantity, unit, category, unit_price,
            confidence, matched_existing, excluded, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          intakeId,
          item.productId || null,
          item.name,
          item.quantity,
          item.unit || "un",
          item.category || "other",
          item.unitPrice ?? null,
          item.confidence ?? null,
          Boolean(item.matchedExisting),
          Boolean(item.excluded),
          item.sortOrder ?? i,
        ],
      );
      created.push(rows[0]);
    }
    return created;
  },

  async listByIntake(intakeId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM stock_intake_items
       WHERE intake_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [intakeId],
    );
    return rows;
  },

  async replaceAll(intakeId, items, client = db) {
    await client.query("DELETE FROM stock_intake_items WHERE intake_id = $1", [intakeId]);
    return this.createMany(intakeId, items, client);
  },
};

module.exports = StockIntakeItemRepository;
