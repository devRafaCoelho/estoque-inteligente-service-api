const db = require("../config/db");

const HouseholdInviteRepository = {
  async create(
    { householdId, email, invitedByUserId, tokenHash, role = "member", expiresAt },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO household_invites
         (household_id, email, invited_by_user_id, token_hash, role, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [householdId, email, invitedByUserId, tokenHash, role, expiresAt],
    );
    return rows[0] || null;
  },

  async findValidByHash(tokenHash, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM household_invites
       WHERE token_hash = $1
         AND accepted_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  },

  async findByHash(tokenHash, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM household_invites WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  },

  /** Convite aberto (não aceito, não revogado) para o e-mail nesta casa. */
  async findOpenByHouseholdAndEmail(householdId, email, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM household_invites
       WHERE household_id = $1
         AND lower(email) = lower($2)
         AND accepted_at IS NULL
         AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [householdId, email],
    );
    return rows[0] || null;
  },

  async revokeOpenByHouseholdAndEmail(householdId, email, client = db) {
    await client.query(
      `UPDATE household_invites
       SET revoked_at = NOW()
       WHERE household_id = $1
         AND lower(email) = lower($2)
         AND accepted_at IS NULL
         AND revoked_at IS NULL`,
      [householdId, email],
    );
  },

  async markAccepted(id, client = db) {
    const { rows } = await client.query(
      `UPDATE household_invites
       SET accepted_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return rows[0] || null;
  },

  async listOpenByHousehold(householdId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM household_invites
       WHERE household_id = $1
         AND accepted_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [householdId],
    );
    return rows;
  },

  async findById(id, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM household_invites WHERE id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  },

  async revokeById(id, client = db) {
    const { rows } = await client.query(
      `UPDATE household_invites
       SET revoked_at = NOW()
       WHERE id = $1
         AND accepted_at IS NULL
         AND revoked_at IS NULL
       RETURNING *`,
      [id],
    );
    return rows[0] || null;
  },
};

module.exports = HouseholdInviteRepository;
