const db = require("../config/db");

const MetaRepository = {
  async listCategories(client = db) {
    const { rows } = await client.query(
      `SELECT code, label
       FROM product_categories
       WHERE active = TRUE
       ORDER BY sort_order ASC, label ASC`,
    );
    return rows;
  },

  async listUnits(client = db) {
    const { rows } = await client.query(
      `SELECT code, label
       FROM stock_units
       WHERE active = TRUE
       ORDER BY sort_order ASC, label ASC`,
    );
    return rows;
  },

  async listStates(client = db) {
    const { rows } = await client.query(
      `SELECT code, name
       FROM brazilian_states
       WHERE active = TRUE
       ORDER BY sort_order ASC, name ASC`,
    );
    return rows;
  },
};

module.exports = MetaRepository;
