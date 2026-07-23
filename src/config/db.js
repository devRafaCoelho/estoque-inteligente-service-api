const { Pool } = require("pg");
const env = require("./env");
const logger = require("../utils/logger");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Evita ficar preso em conexão morta após idle do Postgres
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  logger.error("Erro inesperado no pool do PostgreSQL", { error: err.message });
});

function isTransientConnectionError(err) {
  if (!err) return false;
  const code = err.code;
  // 57P01 admin_shutdown, 57P02 crash, 57P03 cannot_connect_now, ECONNRESET, etc.
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "08P01" ||
    /connection (terminated|ended|refused)/i.test(err.message || "")
  );
}

async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (!isTransientConnectionError(err)) throw err;
    logger.warn("Reintentando query após falha de conexão com o PostgreSQL", {
      error: err.message,
      code: err.code,
    });
    return pool.query(text, params);
  }
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // conexão pode já ter caído
    }
    throw err;
  } finally {
    client.release();
  }
}

async function warmUp() {
  await pool.query("SELECT 1");
}

module.exports = { pool, query, withTransaction, warmUp };
