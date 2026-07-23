const MetaRepository = require("../repositories/MetaRepository");
const { CATEGORIES, UNITS } = require("../schemas/productSchemas");
const logger = require("../utils/logger");

/** Fallback se as tabelas ainda não foram criadas/seedadas. */
const FALLBACK_CATEGORIES = [
  { code: "cleaning", label: "Limpeza" },
  { code: "hygiene", label: "Higiene" },
  { code: "produce", label: "Hortifruti" },
  { code: "grocery", label: "Mercearia" },
  { code: "dairy", label: "Laticínios" },
  { code: "beverages", label: "Bebidas" },
  { code: "frozen", label: "Congelados" },
  { code: "household", label: "Casa" },
  { code: "other", label: "Outros" },
];

const FALLBACK_UNITS = [
  { code: "un", label: "un" },
  { code: "g", label: "g" },
  { code: "kg", label: "kg" },
  { code: "ml", label: "ml" },
  { code: "l", label: "L" },
  { code: "pack", label: "pct" },
  { code: "can", label: "lata" },
  { code: "bottle", label: "garrafa" },
  { code: "box", label: "cx" },
  { code: "other", label: "outro" },
];

const FALLBACK_STATES = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
];

async function withFallback(label, queryFn, fallback) {
  try {
    const rows = await queryFn();
    return rows.length ? rows : fallback;
  } catch (err) {
    logger.warn(`${label}: usando fallback (execute database_ref_data.sql)`, {
      error: err.message,
    });
    return fallback;
  }
}

const CatalogService = {
  async listCategories() {
    const categories = await withFallback(
      "product-categories",
      () => MetaRepository.listCategories(),
      FALLBACK_CATEGORIES.filter((c) => CATEGORIES.includes(c.code)),
    );
    return { categories };
  },

  async listUnits() {
    const units = await withFallback(
      "stock-units",
      () => MetaRepository.listUnits(),
      FALLBACK_UNITS.filter((u) => UNITS.includes(u.code)),
    );
    return { units };
  },

  async listStates() {
    const states = await withFallback(
      "brazilian-states",
      () => MetaRepository.listStates(),
      FALLBACK_STATES,
    );
    return { states };
  },
};

module.exports = CatalogService;
