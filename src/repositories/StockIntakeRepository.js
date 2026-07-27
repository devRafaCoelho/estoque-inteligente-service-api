const db = require("../config/db");
const { clampLimit } = require("../utils/pagination");

const StockIntakeRepository = {
  async create(
    { userId, source, status = "draft", rawInput = null, rawPayload = {}, stateCode = null },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO stock_intakes
         (user_id, source, status, raw_input, raw_payload, state_code)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [userId, source, status, rawInput, JSON.stringify(rawPayload || {}), stateCode],
    );
    return rows[0];
  },

  async findById(userId, id, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM stock_intakes
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
      `SELECT i.*,
              COALESCE(c.item_count, 0)::int AS item_count
       FROM stock_intakes i
       LEFT JOIN (
         SELECT intake_id, COUNT(*)::int AS item_count
         FROM stock_intake_items
         GROUP BY intake_id
       ) c ON c.intake_id = i.id
       WHERE i.user_id = $1
         AND i.status = $2
       ORDER BY i.updated_at DESC
       LIMIT $3`,
      [userId, status, clampLimit(limit, { min: 1, max: 50, fallback: 20 })],
    );
    return rows;
  },

  async updateStatus(userId, id, status, extra = {}, client = db) {
    const { rows } = await client.query(
      `UPDATE stock_intakes
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
      `UPDATE stock_intakes
       SET status = 'cancelled', updated_at = NOW()
       WHERE user_id = $1 AND status = $2`,
      [userId, status],
    );
    return rowCount || 0;
  },

  async updateRawPayload(userId, id, rawPayload, client = db) {
    const { rows } = await client.query(
      `UPDATE stock_intakes
       SET raw_payload = $1::jsonb, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [JSON.stringify(rawPayload || {}), id, userId],
    );
    return rows[0] || null;
  },
};

module.exports = StockIntakeRepository;
