const db = require("../config/db");

const ChatRepository = {
  async findById(userId, sessionId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM chat_sessions
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [sessionId, userId],
    );
    return rows[0] || null;
  },

  async findLatest(userId, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM chat_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  },

  async create(userId, { title = null } = {}, client = db) {
    const { rows } = await client.query(
      `INSERT INTO chat_sessions (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, title],
    );
    return rows[0];
  },

  async touch(sessionId, { title = undefined } = {}, client = db) {
    const { rows } = await client.query(
      `UPDATE chat_sessions
       SET updated_at = NOW(),
           title = COALESCE($2, title)
       WHERE id = $1
       RETURNING *`,
      [sessionId, title === undefined ? null : title],
    );
    return rows[0] || null;
  },

  async listMessages(sessionId, { limit = 40 } = {}, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM (
         SELECT * FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) recent
       ORDER BY created_at ASC`,
      [sessionId, limit],
    );
    return rows;
  },

  async createMessage(
    { sessionId, role, content, payload = {} },
    client = db,
  ) {
    const { rows } = await client.query(
      `INSERT INTO chat_messages (session_id, role, content, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [sessionId, role, content, JSON.stringify(payload || {})],
    );
    return rows[0];
  },
};

module.exports = ChatRepository;
