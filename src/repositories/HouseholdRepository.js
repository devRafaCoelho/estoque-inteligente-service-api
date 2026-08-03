const db = require("../config/db");

const HouseholdRepository = {
  async create({ name, ownerUserId }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO households (name, owner_user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, ownerUserId],
    );
    return rows[0] || null;
  },

  async findById(id, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM households WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  },

  async findOwnedByUser(userId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM households
       WHERE owner_user_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  },

  async findForUser(userId, client = db) {
    const { rows } = await client.query(
      `SELECT h.*
       FROM households h
       JOIN household_members m ON m.household_id = h.id
       WHERE m.user_id = $1
       ORDER BY m.joined_at ASC
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  },

  async updateName(id, name, client = db) {
    const { rows } = await client.query(
      `UPDATE households
       SET name = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name],
    );
    return rows[0] || null;
  },

  async deleteById(id, client = db) {
    const { rows } = await client.query(
      `DELETE FROM households WHERE id = $1 RETURNING *`,
      [id],
    );
    return rows[0] || null;
  },
};

module.exports = HouseholdRepository;
