const db = require("../config/db");
const { resolveScope, appendScopeWhere } = require("../utils/resolveScope");

const ProductRepository = {
  async list(userId, filters = {}, client = db) {
    const scope = await resolveScope(userId, client);
    const where = [];
    const values = [];
    let i = appendScopeWhere(where, values, scope, 1);

    where.push("deleted_at IS NULL");

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
    const scope = await resolveScope(userId, client);
    const where = ["id = $1", "deleted_at IS NULL"];
    const values = [id];
    appendScopeWhere(where, values, scope, 2);
    const { rows } = await client.query(
      `SELECT * FROM products WHERE ${where.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  },

  async findByName(userId, name, client = db) {
    const scope = await resolveScope(userId, client);
    const where = ["LOWER(name) = LOWER($1)", "deleted_at IS NULL"];
    const values = [name];
    appendScopeWhere(where, values, scope, 2);
    const { rows } = await client.query(
      `SELECT * FROM products WHERE ${where.join(" AND ")} LIMIT 1`,
      values,
    );
    return rows[0] || null;
  },

  async create(userId, data, client = db) {
    const scope = await resolveScope(userId, client);
    const lastPurchasedAt = Number(data.quantity) > 0 ? new Date() : null;
    const { rows } = await client.query(
      `INSERT INTO products
        (user_id, household_id, name, category, quantity, unit, min_quantity, avg_unit_price, repurchase_days, notes, last_purchased_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        scope.householdId,
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
    const scope = await resolveScope(userId, client);
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
    values.push(id);
    const where = [`id = $${i}`];
    appendScopeWhere(where, values, scope, i + 1);
    const { rows } = await client.query(
      `UPDATE products SET ${sets.join(", ")}
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async setQuantity(userId, id, quantity, { consumed = false } = {}, client = db) {
    const scope = await resolveScope(userId, client);
    const extra = consumed ? ", last_consumed_at = NOW()" : "";
    const values = [quantity, id];
    const where = ["id = $2"];
    appendScopeWhere(where, values, scope, 3);
    const { rows } = await client.query(
      `UPDATE products
       SET quantity = $1, updated_at = NOW()${extra}
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
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
    const scope = await resolveScope(userId, client);
    const values = [avgWeeklyUsage, consumptionCycleDays, id];
    const where = ["id = $3"];
    appendScopeWhere(where, values, scope, 4);
    const { rows } = await client.query(
      `UPDATE products
       SET avg_weekly_usage = $1,
           consumption_cycle_days = $2,
           updated_at = NOW()
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async applyIntake(userId, id, { quantity, avgUnitPrice, unit, category }, client = db) {
    const scope = await resolveScope(userId, client);
    const values = [
      quantity,
      avgUnitPrice,
      unit || null,
      category || null,
      id,
    ];
    const where = ["id = $5"];
    appendScopeWhere(where, values, scope, 6);
    const { rows } = await client.query(
      `UPDATE products
       SET quantity = $1,
           avg_unit_price = COALESCE($2, avg_unit_price),
           unit = COALESCE($3, unit),
           category = COALESCE($4, category),
           last_purchased_at = NOW(),
           updated_at = NOW()
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  /**
   * Atribui produtos solo do usuário ao household (backfill ao criar casa).
   */
  async attachSoloToHousehold(userId, householdId, client = db) {
    const { rowCount } = await client.query(
      `UPDATE products
       SET household_id = $1, updated_at = NOW()
       WHERE user_id = $2 AND household_id IS NULL AND deleted_at IS NULL`,
      [householdId, userId],
    );
    return rowCount || 0;
  },

  /**
   * Soft-delete: preserva stock_movements / purchase_items (histórico).
   * Itens de lista de compras devem ser limpos no serviço.
   */
  async softDelete(userId, id, client = db) {
    const scope = await resolveScope(userId, client);
    const values = [id];
    const where = ["id = $1", "deleted_at IS NULL"];
    appendScopeWhere(where, values, scope, 2);
    const { rows } = await client.query(
      `UPDATE products
       SET active = FALSE,
           deleted_at = NOW(),
           updated_at = NOW()
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },
};

module.exports = ProductRepository;
