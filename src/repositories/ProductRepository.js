const db = require("../config/db");

const ProductRepository = {
  async list(userId, filters = {}, client = db) {
    const where = ["user_id = $1"];
    const values = [userId];
    let i = 2;

    if (filters.active !== undefined) {
      where.push(`active = $${i++}`);
      values.push(filters.active);
    } else {
      where.push("active = TRUE");
    }

    if (filters.category) {
      where.push(`category = $${i++}`);
      values.push(filters.category);
    }

    if (filters.search) {
      where.push(`name ILIKE $${i++}`);
      values.push(`%${filters.search}%`);
    }

    if (filters.status === "out") {
      where.push("quantity = 0");
    } else if (filters.status === "low") {
      where.push("quantity > 0 AND quantity <= min_quantity");
    } else if (filters.status === "ok") {
      where.push("quantity > min_quantity");
    }

    const { rows } = await client.query(
      `SELECT * FROM products
       WHERE ${where.join(" AND ")}
       ORDER BY name ASC`,
      values,
    );
    return rows;
  },

  async findById(userId, id, client = db) {
    const { rows } = await client.query(
      "SELECT * FROM products WHERE id = $1 AND user_id = $2 LIMIT 1",
      [id, userId],
    );
    return rows[0] || null;
  },

  async findByName(userId, name, client = db) {
    const { rows } = await client.query(
      "SELECT * FROM products WHERE user_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
      [userId, name],
    );
    return rows[0] || null;
  },

  async create(userId, data, client = db) {
    const lastPurchasedAt = Number(data.quantity) > 0 ? new Date() : null;
    const { rows } = await client.query(
      `INSERT INTO products
        (user_id, name, category, quantity, unit, min_quantity, avg_unit_price, repurchase_days, notes, last_purchased_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        data.name,
        data.category,
        data.quantity,
        data.unit,
        data.minQuantity,
        data.avgUnitPrice ?? null,
        data.repurchaseDays ?? null,
        data.notes ?? null,
        lastPurchasedAt,
      ],
    );
    return rows[0];
  },

  async update(userId, id, fields, client = db) {
    const allowed = {
      name: "name",
      category: "category",
      quantity: "quantity",
      unit: "unit",
      minQuantity: "min_quantity",
      avgUnitPrice: "avg_unit_price",
      repurchaseDays: "repurchase_days",
      notes: "notes",
      active: "active",
    };
    const sets = [];
    const values = [];
    let i = 1;
    for (const [key, column] of Object.entries(allowed)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = $${i++}`);
        values.push(fields[key]);
      }
    }
    if (!sets.length) return this.findById(userId, id, client);
    sets.push("updated_at = NOW()");
    values.push(id, userId);
    const { rows } = await client.query(
      `UPDATE products SET ${sets.join(", ")}
       WHERE id = $${i++} AND user_id = $${i}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async setQuantity(userId, id, quantity, { consumed = false } = {}, client = db) {
    const extra = consumed ? ", last_consumed_at = NOW()" : "";
    const { rows } = await client.query(
      `UPDATE products
       SET quantity = $1, updated_at = NOW()${extra}
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [quantity, id, userId],
    );
    return rows[0] || null;
  },

  /**
   * Persiste sinais de consumo derivados do histórico de baixas.
   */
  async updateConsumptionStats(
    userId,
    id,
    { avgWeeklyUsage, consumptionCycleDays },
    client = db,
  ) {
    const { rows } = await client.query(
      `UPDATE products
       SET avg_weekly_usage = $1,
           consumption_cycle_days = $2,
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [avgWeeklyUsage, consumptionCycleDays, id, userId],
    );
    return rows[0] || null;
  },

  async applyIntake(userId, id, { quantity, avgUnitPrice, unit, category }, client = db) {
    const { rows } = await client.query(
      `UPDATE products
       SET quantity = $1,
           avg_unit_price = COALESCE($2, avg_unit_price),
           unit = COALESCE($3, unit),
           category = COALESCE($4, category),
           last_purchased_at = NOW(),
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [quantity, avgUnitPrice, unit || null, category || null, id, userId],
    );
    return rows[0] || null;
  },
};

module.exports = ProductRepository;
