const db = require("../config/db");
const logger = require("../utils/logger");

const CATEGORIES = [
  ["cleaning", "Limpeza", 10],
  ["hygiene", "Higiene", 20],
  ["produce", "Hortifruti", 30],
  ["grocery", "Mercearia", 40],
  ["dairy", "Laticínios", 50],
  ["beverages", "Bebidas", 60],
  ["frozen", "Congelados", 70],
  ["household", "Casa", 80],
  ["other", "Outros", 90],
];

const UNITS = [
  ["un", "un", 10],
  ["g", "g", 20],
  ["kg", "kg", 30],
  ["ml", "ml", 40],
  ["l", "L", 50],
  ["pack", "pct", 60],
  ["can", "lata", 70],
  ["bottle", "garrafa", 80],
  ["box", "cx", 90],
  ["other", "outro", 100],
];

const STATES = [
  ["AC", "Acre", 1],
  ["AL", "Alagoas", 2],
  ["AP", "Amapá", 3],
  ["AM", "Amazonas", 4],
  ["BA", "Bahia", 5],
  ["CE", "Ceará", 6],
  ["DF", "Distrito Federal", 7],
  ["ES", "Espírito Santo", 8],
  ["GO", "Goiás", 9],
  ["MA", "Maranhão", 10],
  ["MT", "Mato Grosso", 11],
  ["MS", "Mato Grosso do Sul", 12],
  ["MG", "Minas Gerais", 13],
  ["PA", "Pará", 14],
  ["PB", "Paraíba", 15],
  ["PR", "Paraná", 16],
  ["PE", "Pernambuco", 17],
  ["PI", "Piauí", 18],
  ["RJ", "Rio de Janeiro", 19],
  ["RN", "Rio Grande do Norte", 20],
  ["RS", "Rio Grande do Sul", 21],
  ["RO", "Rondônia", 22],
  ["RR", "Roraima", 23],
  ["SC", "Santa Catarina", 24],
  ["SP", "São Paulo", 25],
  ["SE", "Sergipe", 26],
  ["TO", "Tocantins", 27],
];

/**
 * Garante rótulos de catálogo (categorias, unidades, UFs).
 * O database.sql cria só a estrutura — sem INSERTs.
 */
async function ensureReferenceData() {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    for (const [code, label, sortOrder] of CATEGORIES) {
      await client.query(
        `INSERT INTO product_categories (code, label, sort_order, active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (code) DO UPDATE
         SET label = EXCLUDED.label,
             sort_order = EXCLUDED.sort_order,
             active = TRUE`,
        [code, label, sortOrder],
      );
    }

    for (const [code, label, sortOrder] of UNITS) {
      await client.query(
        `INSERT INTO stock_units (code, label, sort_order, active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (code) DO UPDATE
         SET label = EXCLUDED.label,
             sort_order = EXCLUDED.sort_order,
             active = TRUE`,
        [code, label, sortOrder],
      );
    }

    for (const [code, name, sortOrder] of STATES) {
      await client.query(
        `INSERT INTO brazilian_states (code, name, sort_order, active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             sort_order = EXCLUDED.sort_order,
             active = TRUE`,
        [code, name, sortOrder],
      );
    }

    await client.query("COMMIT");
    logger.info("Catálogos de referência garantidos (categories/units/states)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { ensureReferenceData };
