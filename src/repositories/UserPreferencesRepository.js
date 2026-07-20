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
};

module.exports = UserPreferencesRepository;
