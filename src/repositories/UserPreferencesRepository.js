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

  async update(userId, fields, client = db) {
    const allowed = {
      notifyLowStock: "notify_low_stock",
      notifyOutOfStock: "notify_out_of_stock",
      notifyRepurchase: "notify_repurchase",
      notifyConsumptionNudge: "notify_consumption_nudge",
      notifyEmailDigest: "notify_email_digest",
      consumptionNudgeDays: "consumption_nudge_days",
      pushEnabled: "push_enabled",
      quietHoursEnabled: "quiet_hours_enabled",
      quietHoursStart: "quiet_hours_start",
      quietHoursEnd: "quiet_hours_end",
      quietHoursTimezone: "quiet_hours_timezone",
      shoppingListViewMode: "shopping_list_view_mode",
      lastEmailDigestAt: "last_email_digest_at",
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
    if (!sets.length) return this.findByUser(userId, client);
    sets.push("updated_at = NOW()");
    values.push(userId);
    const { rows } = await client.query(
      `UPDATE user_preferences
       SET ${sets.join(", ")}
       WHERE user_id = $${i}
       RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async touchDigestSentAt(userId, client = db) {
    const { rows } = await client.query(
      `UPDATE user_preferences
       SET last_email_digest_at = NOW(), updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId],
    );
    return rows[0] || null;
  },
};

module.exports = UserPreferencesRepository;
