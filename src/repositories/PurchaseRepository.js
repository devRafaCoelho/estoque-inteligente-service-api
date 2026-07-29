const db = require("../config/db");
const { clampLimit } = require("../utils/pagination");
const { lineTotal } = require("../utils/money");
const { resolveHouseholdUserIds } = require("../utils/resolveScope");

const PurchaseRepository = {
  async sumTotal(userId, from, to, client = db) {
    const userIds = await resolveHouseholdUserIds(userId, client);
    const { rows } = await client.query(
      `SELECT COALESCE(SUM(total_amount), 0)::float AS total,
              COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = ANY($1::uuid[])
         AND purchased_at >= $2
         AND purchased_at < $3`,
      [userIds, from, to],
    );
    return {
      total: Number(rows[0]?.total) || 0,
      count: rows[0]?.count || 0,
    };
  },

  async byCategory(userId, from, to, client = db) {
    const userIds = await resolveHouseholdUserIds(userId, client);
    const { rows } = await client.query(
      `SELECT COALESCE(pi.category, 'other') AS category,
              COALESCE(SUM(pi.line_total), 0)::float AS total,
              COUNT(*)::int AS lines
       FROM purchase_items pi
       JOIN purchases p ON p.id = pi.purchase_id
       WHERE p.user_id = ANY($1::uuid[])
         AND p.purchased_at >= $2
         AND p.purchased_at < $3
         AND pi.line_total IS NOT NULL
       GROUP BY COALESCE(pi.category, 'other')
       ORDER BY total DESC`,
      [userIds, from, to],
    );
    return rows.map((row) => ({
      category: row.category,
      total: Number(row.total) || 0,
      lines: row.lines,
    }));
  },

  async monthlySeries(userId, year, client = db) {
    const userIds = await resolveHouseholdUserIds(userId, client);
    const { rows } = await client.query(
      `SELECT EXTRACT(MONTH FROM purchased_at)::int AS month,
              COALESCE(SUM(total_amount), 0)::float AS total,
              COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = ANY($1::uuid[])
         AND purchased_at >= make_date($2::int, 1, 1)
         AND purchased_at < make_date($2::int + 1, 1, 1)
       GROUP BY 1
       ORDER BY 1 ASC`,
      [userIds, year],
    );
    return rows.map((row) => ({
      month: row.month,
      total: Number(row.total) || 0,
      count: row.count,
    }));
  },

  async listRecent(userId, limit = 10, client = db) {
    const userIds = await resolveHouseholdUserIds(userId, client);
    const { rows } = await client.query(
      `SELECT id, store_name, purchased_at, total_amount, currency
       FROM purchases
       WHERE user_id = ANY($1::uuid[])
       ORDER BY purchased_at DESC
       LIMIT $2`,
      [userIds, clampLimit(limit, { min: 1, max: 50, fallback: 10 })],
    );
    return rows;
  },

  /**
   * Cria purchase + itens numa transação (client obrigatório).
   */
  async createWithItems(
    { userId, intakeId, storeName = null, purchasedAt = null, items = [] },
    client = db,
  ) {
    const total = items.reduce((sum, item) => {
      const line = lineTotal(item.quantity, item.unitPrice);
      return sum + (line ?? 0);
    }, 0);
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO purchases (user_id, intake_id, store_name, purchased_at, total_amount)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5)
       RETURNING *`,
      [userId, intakeId, storeName, purchasedAt, total],
    );
    const purchase = purchaseRows[0];

    for (const item of items) {
      const line = lineTotal(item.quantity, item.unitPrice) ?? 0;
      await client.query(
        `INSERT INTO purchase_items
           (purchase_id, product_id, name, quantity, unit, unit_price, line_total, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          purchase.id,
          item.productId || null,
          item.name,
          item.quantity,
          item.unit,
          item.unitPrice,
          line,
          item.category || null,
        ],
      );
    }

    return purchase;
  },
};

module.exports = PurchaseRepository;
