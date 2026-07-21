const db = require("../config/db");

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
