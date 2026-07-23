const db = require("../config/db");
const { digitsOnly, splitPersonName } = require("../helpers/personName");

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

  async create(
    {
      firstName,
      lastName = null,
      name,
      email,
      passwordHash,
      avatarUrl = null,
      defaultState = null,
    },
    client = db,
  ) {
    const resolved = firstName
      ? { firstName, lastName: lastName || null }
      : splitPersonName(name);

    const { rows } = await client.query(
      `INSERT INTO users (
         first_name, last_name, email, password_hash, avatar_url, default_state
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        resolved.firstName,
        resolved.lastName,
        email,
        passwordHash,
        avatarUrl,
        defaultState,
      ],
    );
    return rows[0];
  },

  async update(id, fields, client = db) {
    const allowed = {
      firstName: "first_name",
      lastName: "last_name",
      avatarUrl: "avatar_url",
      phone: "phone",
      cpf: "cpf",
      zipCode: "zip_code",
      street: "street",
      streetNumber: "street_number",
      complement: "complement",
      neighborhood: "neighborhood",
      city: "city",
      defaultState: "default_state",
    };

    const digitFields = new Set(["phone", "cpf", "zipCode"]);
    const sets = [];
    const values = [];
    let i = 1;

    for (const [key, column] of Object.entries(allowed)) {
      if (fields[key] === undefined) continue;
      let value = fields[key];
      if (value === "") value = null;
      else if (digitFields.has(key) && value != null) value = digitsOnly(value) || null;
      sets.push(`${column} = $${i++}`);
      values.push(value);
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
