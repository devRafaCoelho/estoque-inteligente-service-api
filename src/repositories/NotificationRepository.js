const db = require("../config/db");
const { clampLimit } = require("../utils/pagination");

const NotificationRepository = {
  async list(userId, { unreadOnly = false, limit = 50 } = {}, client = db) {
    const values = [userId];
    const where = ["user_id = $1"];
    if (unreadOnly) {
      where.push("read_at IS NULL");
    }
    values.push(clampLimit(limit, { min: 1, max: 100, fallback: 50 }));
    const { rows } = await client.query(
      `SELECT * FROM notifications
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $2`,
      values,
    );
    return rows;
  },

  async countUnread(userId, client = db) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return rows[0]?.count || 0;
  },

  async findById(userId, id, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM notifications
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [id, userId],
    );
    return rows[0] || null;
  },

  /**
   * Qualquer alerta recente do mesmo tipo/produto (lido ou não).
   * Evita recriar o mesmo aviso logo após o usuário marcar como lido.
   */
  async findRecentForProduct(userId, type, productId, hours = 72, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND created_at >= NOW() - make_interval(hours => $4::int)
         AND (
           ($3::uuid IS NULL AND product_id IS NULL)
           OR product_id = $3
         )
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, type, productId || null, hours],
    );
    return rows[0] || null;
  },

  async create(
    { userId, type, title, body, productId = null, payload = {} },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO notifications
        (user_id, type, title, body, product_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [
        userId,
        type,
        title,
        body,
        productId,
        JSON.stringify(payload || {}),
      ],
    );
    return rows[0];
  },

  async markRead(userId, id, client = db) {
    const { rows } = await client.query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId],
    );
    return rows[0] || null;
  },

  async markAllRead(userId, client = db) {
    const { rowCount } = await client.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return rowCount || 0;
  },

  async findRecentByType(userId, type, days = 5, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND created_at >= NOW() - make_interval(days => $3::int)
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, type, days],
    );
    return rows[0] || null;
  },
};

module.exports = NotificationRepository;
