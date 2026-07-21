const db = require("../config/db");

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
};

module.exports = StockOutRepository;
