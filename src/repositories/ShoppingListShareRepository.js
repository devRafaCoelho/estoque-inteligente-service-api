const db = require("../config/db");

const ShoppingListShareRepository = {
  async create({ listId, userId, tokenHash, expiresAt }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO shopping_list_shares (list_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [listId, userId, tokenHash, expiresAt],
    );
    return rows[0] || null;
  },

  /** Busca share válido (não expirado, não revogado) pelo hash do token. */
  async findValidByHash(tokenHash, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_list_shares
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return rows[0] || null;
  },

  /** Busca share por id (qualquer status). */
  async findById(shareId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_list_shares WHERE id = $1 LIMIT 1`,
      [shareId],
    );
    return rows[0] || null;
  },

  /** Lista shares ativos do usuário para a lista informada. */
  async listActiveByUser(userId, listId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM shopping_list_shares
       WHERE user_id = $1
         AND list_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId, listId],
    );
    return rows;
  },

  /** Revoga um share específico do usuário. */
  async revoke(userId, shareId, client = db) {
    const { rows } = await client.query(
      `UPDATE shopping_list_shares
       SET revoked_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
       RETURNING *`,
      [shareId, userId],
    );
    return rows[0] || null;
  },

  /** Revoga todos os shares ativos do usuário para a lista (ex.: ao limpar). */
  async revokeAllByUser(userId, listId, client = db) {
    await client.query(
      `UPDATE shopping_list_shares
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND list_id = $2
         AND revoked_at IS NULL`,
      [userId, listId],
    );
  },
};

module.exports = ShoppingListShareRepository;
