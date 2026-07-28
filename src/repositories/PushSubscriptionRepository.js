const db = require("../config/db");

const PushSubscriptionRepository = {
  async listByUser(userId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM push_subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  },

  async countByUser(userId, client = db) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM push_subscriptions
       WHERE user_id = $1`,
      [userId],
    );
    return rows[0]?.count || 0;
  },

  async upsert(userId, subscription, userAgent = null, client = db) {
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    const { rows } = await client.query(
      `INSERT INTO push_subscriptions
        (user_id, endpoint, p256dh_key, auth_key, user_agent, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh_key = EXCLUDED.p256dh_key,
           auth_key = EXCLUDED.auth_key,
           user_agent = EXCLUDED.user_agent,
           last_seen_at = NOW()
       RETURNING *`,
      [userId, endpoint, p256dh, auth, userAgent],
    );
    return rows[0] || null;
  },

  async deleteByEndpoint(endpoint, client = db) {
    const { rowCount } = await client.query(
      "DELETE FROM push_subscriptions WHERE endpoint = $1",
      [endpoint],
    );
    return rowCount || 0;
  },

  async deleteByUserAndEndpoint(userId, endpoint, client = db) {
    const { rowCount } = await client.query(
      "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
      [userId, endpoint],
    );
    return rowCount || 0;
  },
};

module.exports = PushSubscriptionRepository;
