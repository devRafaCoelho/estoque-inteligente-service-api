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

  async monthlySeries(userId, year, client = db) {
    const { rows } = await client.query(
      `SELECT EXTRACT(MONTH FROM purchased_at)::int AS month,
              COALESCE(SUM(total_amount), 0)::float AS total,
              COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = $1
         AND purchased_at >= make_date($2::int, 1, 1)
         AND purchased_at < make_date($2::int + 1, 1, 1)
       GROUP BY 1
       ORDER BY 1 ASC`,
      [userId, year],
    );
    return rows.map((row) => ({
      month: row.month,
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
