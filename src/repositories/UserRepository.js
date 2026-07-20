const db = require("../config/db");

const UserRepository = {
  async findByEmail(email, client = db) {
    const { rows } = await client.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email],
    );
    return rows[0] || null;
  },

  async findById(id, client = db) {
    const { rows } = await client.query(
      "SELECT * FROM users WHERE id = $1 LIMIT 1",
      [id],
    );
    return rows[0] || null;
  },

  async create({ name, email, passwordHash, avatarUrl = null, defaultState = null }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash, avatar_url, default_state)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, passwordHash, avatarUrl, defaultState],
    );
    return rows[0];
  },

  async update(id, fields, client = db) {
    const allowed = {
      name: "name",
      avatarUrl: "avatar_url",
      defaultState: "default_state",
    };
    const sets = [];
    const values = [];
    let i = 1;
    for (const [key, column] of Object.entries(allowed)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = $${i++}`);
        values.push(fields[key] === "" ? null : fields[key]);
      }
    }
    if (!sets.length) return this.findById(id, client);
    sets.push("updated_at = NOW()");
    values.push(id);
    const { rows } = await client.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      values,
    );
    return rows[0];
  },

  async updatePassword(id, passwordHash, client = db) {
    await client.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, id],
    );
  },

  async touchLastLogin(id, client = db) {
    await client.query(
      "UPDATE users SET last_login_at = NOW() WHERE id = $1",
      [id],
    );
  },

  async softDelete(id, client = db) {
    await client.query(
      `UPDATE users
       SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  },
};

module.exports = UserRepository;
