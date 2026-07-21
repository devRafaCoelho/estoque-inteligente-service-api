const db = require("../config/db");

const UserPreferencesRepository = {
  async createDefaults(userId, client = db) {
    await client.query(
      `INSERT INTO user_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  },

  async findByUser(userId, client = db) {
    const { rows } = await client.query(
      "SELECT * FROM user_preferences WHERE user_id = $1",
      [userId],
    );
    return rows[0] || null;
  },

  async updateViewMode(userId, viewMode, client = db) {
    const { rows } = await client.query(
      `UPDATE user_preferences
       SET shopping_list_view_mode = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [viewMode, userId],
    );
    return rows[0] || null;
  },
};

module.exports = UserPreferencesRepository;
