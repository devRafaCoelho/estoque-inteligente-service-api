const db = require("../config/db");

const UserAuthIdentityRepository = {
  async findByProvider(provider, providerUserId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM user_auth_identities
       WHERE provider = $1 AND provider_user_id = $2
       LIMIT 1`,
      [provider, providerUserId],
    );
    return rows[0] || null;
  },

  async listByUserId(userId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM user_auth_identities
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    );
    return rows;
  },

  async listProvidersByUserId(userId, client = db) {
    const rows = await this.listByUserId(userId, client);
    return rows.map((row) => row.provider);
  },

  async create(
    { userId, provider, providerUserId, email = null, emailVerified = false },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO user_auth_identities
         (user_id, provider, provider_user_id, email, email_verified, last_used_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, provider, providerUserId, email, emailVerified],
    );
    return rows[0];
  },

  async touchLastUsed(id, client = db) {
    await client.query(
      "UPDATE user_auth_identities SET last_used_at = NOW() WHERE id = $1",
      [id],
    );
  },

  async deactivateByUserId(userId, client = db) {
    // Soft-delete da conta: remove vínculos OAuth para impedir reuso do mesmo sub em outra conta.
    await client.query("DELETE FROM user_auth_identities WHERE user_id = $1", [userId]);
  },
};

module.exports = UserAuthIdentityRepository;
