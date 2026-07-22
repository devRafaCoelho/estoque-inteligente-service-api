const db = require("../config/db");

const PurchaseRepository = {
  async sumTotal(userId, from, to, client = db) {
    const { rows } = await client.query(
      `SELECT COALESCE(SUM(total_amount), 0)::float AS total,
              COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = $1
         AND purchased_at >= $2
         AND purchased_at < $3`,
      [userId, from, to],
    );
    return {
      total: Number(rows[0]?.total) || 0,
      count: rows[0]?.count || 0,
    };
  },

  async byCategory(userId, from, to, client = db) {
    const { rows } = await client.query(
      `SELECT COALESCE(pi.category, 'other') AS category,
              COALESCE(SUM(pi.line_total), 0)::float AS total,
              COUNT(*)::int AS lines
       FROM purchase_items pi
       JOIN purchases p ON p.id = pi.purchase_id
       WHERE p.user_id = $1
         AND p.purchased_at >= $2
         AND p.purchased_at < $3
         AND pi.line_total IS NOT NULL
       GROUP BY COALESCE(pi.category, 'other')
       ORDER BY total DESC`,
      [userId, from, to],
    );
    return rows.map((row) => ({
      category: row.category,
      total: Number(row.total) || 0,
      lines: row.lines,
    }));
  },

  async weeklySeries(userId, weeks = 8, client = db) {
    const { rows } = await client.query(
      `SELECT date_trunc('week', purchased_at)::date AS week_start,
              COALESCE(SUM(total_amount), 0)::float AS total,
              COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = $1
         AND purchased_at >= NOW() - ($2 * INTERVAL '1 week')
       GROUP BY 1
       ORDER BY 1 ASC`,
      [userId, weeks],
    );
    return rows.map((row) => ({
      weekStart: row.week_start,
      total: Number(row.total) || 0,
      count: row.count,
    }));
  },

  async listRecent(userId, limit = 10, client = db) {
    const { rows } = await client.query(
      `SELECT id, store_name, purchased_at, total_amount, currency
       FROM purchases
       WHERE user_id = $1
       ORDER BY purchased_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows;
  },
};

module.exports = PurchaseRepository;
