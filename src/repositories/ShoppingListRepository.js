const db = require("../config/db");

const ShoppingListRepository = {
  async findActive(userId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_lists
       WHERE user_id = $1 AND status = 'active'
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  },

  async create(userId, { title = "Lista de compras", generatedBy = null } = {}, client = db) {
    const { rows } = await client.query(
      `INSERT INTO shopping_lists (user_id, title, status, generated_by)
       VALUES ($1, $2, 'active', $3)
       RETURNING *`,
      [userId, title, generatedBy],
    );
    return rows[0];
  },

  async touch(userId, listId, { generatedBy } = {}, client = db) {
    const { rows } = await client.query(
      `UPDATE shopping_lists
       SET updated_at = NOW(),
           generated_by = COALESCE($1, generated_by)
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [generatedBy || null, listId, userId],
    );
    return rows[0] || null;
  },

  async archive(userId, listId, client = db) {
    const { rows } = await client.query(
      `UPDATE shopping_lists
       SET status = 'archived', updated_at = NOW(), completed_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [listId, userId],
    );
    return rows[0] || null;
  },
};

module.exports = ShoppingListRepository;
