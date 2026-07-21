const db = require("../config/db");

const StockMovementRepository = {
  async create(data, client = db) {
    const { rows } = await client.query(
      `INSERT INTO stock_movements
        (user_id, product_id, intake_id, stock_out_id, type, quantity, unit,
         quantity_before, quantity_after, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.userId,
        data.productId,
        data.intakeId ?? null,
        data.stockOutId ?? null,
        data.type,
        data.quantity,
        data.unit,
        data.quantityBefore,
        data.quantityAfter,
        data.note ?? null,
      ],
    );
    return rows[0];
  },

  async listByProduct(userId, productId, limit = 50, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM stock_movements
       WHERE user_id = $1 AND product_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, productId, limit],
    );
    return rows;
  },
};

module.exports = StockMovementRepository;
