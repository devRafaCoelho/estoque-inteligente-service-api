const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const logger = require("../utils/logger");

/**
 * Aplica migrações idempotentes necessárias em bancos já existentes
 * (ex.: Render), sem exigir psql manual.
 */
async function ensureSchemaMigrations() {
  const sqlPath = path.join(
    __dirname,
    "../../scripts/alter_products_deleted_at.sql",
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);
  logger.info("Schema migrations aplicadas (products.deleted_at)");
}

module.exports = { ensureSchemaMigrations };
