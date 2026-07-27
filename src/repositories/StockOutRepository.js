const db = require("../config/db");
const { clampLimit } = require("../utils/pagination");

const StockOutRepository = {
  async create(
    { userId, source, status = "draft", rawInput = null, rawPayload = {} },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO stock_outs
         (user_id, source, status, raw_input, raw_payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [userId, source, status, rawInput, JSON.stringify(rawPayload || {})],
    );
    return rows[0];
  },

  async findById(userId, id, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM stock_outs
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [id, userId],
    );
    return rows[0] || null;
  },

  /**
   * @param {string} userId
   * @param {{ status?: string, limit?: number }} [filters]
   */
  async listByUser(userId, { status = "draft", limit = 20 } = {}, client = db) {
    const { rows } = await client.query(
      `SELECT s.*,
              COALESCE(c.item_count, 0)::int AS item_count
       FROM stock_outs s
       LEFT JOIN (
         SELECT stock_out_id, COUNT(*)::int AS item_count
         FROM stock_out_items
         GROUP BY stock_out_id
       ) c ON c.stock_out_id = s.id
       WHERE s.user_id = $1
         AND s.status = $2
       ORDER BY s.updated_at DESC
       LIMIT $3`,
      [userId, status, clampLimit(limit, { min: 1, max: 50, fallback: 20 })],
    );
    return rows;
  },

  async updateStatus(userId, id, status, extra = {}, client = db) {
    const { rows } = await client.query(
      `UPDATE stock_outs
       SET status = $1,
           confirmed_at = COALESCE($2, confirmed_at),
           error_message = COALESCE($3, error_message),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [status, extra.confirmedAt || null, extra.errorMessage || null, id, userId],
    );
    return rows[0] || null;
  },

  async cancelAllByStatus(userId, status = "draft", client = db) {
    const { rowCount } = await client.query(
      `UPDATE stock_outs
       SET status = 'cancelled', updated_at = NOW()
       WHERE user_id = $1 AND status = $2`,
      [userId, status],
    );
    return rowCount || 0;
  },
};

module.exports = StockOutRepository;
