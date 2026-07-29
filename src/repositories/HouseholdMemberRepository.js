const db = require("../config/db");

const HouseholdMemberRepository = {
  async create({ householdId, userId, role }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO household_members (household_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [householdId, userId, role],
    );
    return rows[0] || null;
  },

  async findByHouseholdAndUser(householdId, userId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM household_members
       WHERE household_id = $1 AND user_id = $2
       LIMIT 1`,
      [householdId, userId],
    );
    return rows[0] || null;
  },

  async listByHousehold(householdId, client = db) {
    const { rows } = await client.query(
      `SELECT m.*,
              u.email,
              u.first_name,
              u.last_name,
              u.avatar_url
       FROM household_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.household_id = $1
       ORDER BY
         CASE m.role WHEN 'owner' THEN 0 ELSE 1 END,
         m.joined_at ASC`,
      [householdId],
    );
    return rows;
  },

  async remove(householdId, userId, client = db) {
    const { rows } = await client.query(
      `DELETE FROM household_members
       WHERE household_id = $1 AND user_id = $2
       RETURNING *`,
      [householdId, userId],
    );
    return rows[0] || null;
  },

  async countByHousehold(householdId, client = db) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM household_members
       WHERE household_id = $1`,
      [householdId],
    );
    return rows[0]?.count || 0;
  },
};

module.exports = HouseholdMemberRepository;
