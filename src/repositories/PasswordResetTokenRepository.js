const db = require("../config/db");

const PasswordResetTokenRepository = {
  async invalidateOpenTokens(userId, client = db) {
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL
         AND expires_at > NOW()`,
      [userId],
    );
  },

  async create({ userId, tokenHash, expiresAt }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, tokenHash, expiresAt],
    );
    return rows[0] || null;
  },

  async findValidByHash(tokenHash, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  },

  async markUsed(id, client = db) {
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },
};

module.exports = PasswordResetTokenRepository;
