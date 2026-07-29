const db = require("../config/db");
const { resolveScope, appendScopeWhere } = require("../utils/resolveScope");

const ShoppingListItemRepository = {
  async listByList(listId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_list_items
       WHERE shopping_list_id = $1
       ORDER BY
         checked ASC,
         CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
         sort_order ASC,
         created_at ASC`,
      [listId],
    );
    return rows;
  },

  async findById(userId, itemId, client = db) {
    const scope = await resolveScope(userId, client);
    const where = ["i.id = $1"];
    const values = [itemId];
    appendScopeWhere(where, values, scope, 2, { alias: "l" });
    const { rows } = await client.query(
      `SELECT i.*
       FROM shopping_list_items i
       JOIN shopping_lists l ON l.id = i.shopping_list_id
       WHERE ${where.join(" AND ")}
       LIMIT 1`,
      values,
    );
    return rows[0] || null;
  },

  async createMany(listId, items, client = db) {
    const created = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const { rows } = await client.query(
        `INSERT INTO shopping_list_items
           (shopping_list_id, product_id, name, suggested_qty, unit, priority, origin, checked, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          listId,
          item.productId || null,
          item.name,
          item.suggestedQty ?? null,
          item.unit || "un",
          item.priority || "medium",
          item.origin || "manual",
          Boolean(item.checked),
          item.sortOrder ?? i,
        ],
      );
      created.push(rows[0]);
    }
    return created;
  },

  async deleteUncheckedAuto(listId, client = db) {
    await client.query(
      `DELETE FROM shopping_list_items
       WHERE shopping_list_id = $1
         AND checked = FALSE
         AND origin IN ('low_stock', 'out_of_stock', 'repurchase_time', 'ai')`,
      [listId],
    );
  },

  async update(itemId, fields, client = db) {
    const allowed = {
      name: "name",
      suggestedQty: "suggested_qty",
      unit: "unit",
      priority: "priority",
      checked: "checked",
      productId: "product_id",
      sortOrder: "sort_order",
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
    if (!sets.length) return this.findByIdRaw(itemId, client);
    values.push(itemId);
    const { rows } = await client.query(
      `UPDATE shopping_list_items
       SET ${sets.join(", ")}
       WHERE id = $${i}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async findByIdInList(listId, itemId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_list_items
       WHERE id = $1 AND shopping_list_id = $2
       LIMIT 1`,
      [itemId, listId],
    );
    return rows[0] || null;
  },

  async findByIdRaw(itemId, client = db) {
    const { rows } = await client.query(
      "SELECT * FROM shopping_list_items WHERE id = $1 LIMIT 1",
      [itemId],
    );
    return rows[0] || null;
  },

  async delete(itemId, client = db) {
    await client.query("DELETE FROM shopping_list_items WHERE id = $1", [itemId]);
  },

  async deleteAllByList(listId, client = db) {
    const { rowCount } = await client.query(
      "DELETE FROM shopping_list_items WHERE shopping_list_id = $1",
      [listId],
    );
    return rowCount || 0;
  },
};

module.exports = ShoppingListItemRepository;
