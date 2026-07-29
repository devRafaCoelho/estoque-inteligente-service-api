const db = require("../config/db");
const { resolveScope, appendScopeWhere } = require("../utils/resolveScope");

const ShoppingListRepository = {
  async findActive(userId, client = db) {
    const scope = await resolveScope(userId, client);
    const where = ["status = 'active'"];
    const values = [];
    appendScopeWhere(where, values, scope, 1);
    const { rows } = await client.query(
      `SELECT * FROM shopping_lists
       WHERE ${where.join(" AND ")}
       LIMIT 1`,
      values,
    );
    return rows[0] || null;
  },

  async create(
    userId,
    { title = "Lista de compras", generatedBy = null } = {},
    client = db,
  ) {
    const scope = await resolveScope(userId, client);
    const { rows } = await client.query(
      `INSERT INTO shopping_lists (user_id, household_id, title, status, generated_by)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING *`,
      [userId, scope.householdId, title, generatedBy],
    );
    return rows[0];
  },

  async touch(userId, listId, { generatedBy } = {}, client = db) {
    const scope = await resolveScope(userId, client);
    const values = [generatedBy || null, listId];
    const where = ["id = $2"];
    appendScopeWhere(where, values, scope, 3);
    const { rows } = await client.query(
      `UPDATE shopping_lists
       SET updated_at = NOW(),
           generated_by = COALESCE($1, generated_by)
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async findById(listId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_lists WHERE id = $1 LIMIT 1`,
      [listId],
    );
    return rows[0] || null;
  },

  async archive(userId, listId, client = db) {
    const scope = await resolveScope(userId, client);
    const values = [listId];
    const where = ["id = $1"];
    appendScopeWhere(where, values, scope, 2);
    const { rows } = await client.query(
      `UPDATE shopping_lists
       SET status = 'archived', updated_at = NOW(), completed_at = NOW()
       WHERE ${where.join(" AND ")}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  /**
   * Atribui listas solo do usuário ao household (backfill ao criar casa).
   */
  async attachSoloToHousehold(userId, householdId, client = db) {
    const { rowCount } = await client.query(
      `UPDATE shopping_lists
       SET household_id = $1, updated_at = NOW()
       WHERE user_id = $2 AND household_id IS NULL`,
      [householdId, userId],
    );
    return rowCount || 0;
  },
};

module.exports = ShoppingListRepository;
