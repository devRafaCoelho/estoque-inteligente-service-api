const env = require("../../config/env");
const AppError = require("../../utils/AppError");
const { SpNfCollector, MgNfCollector } = require("./collectors");

const COLLECTORS = {
  SP: SpNfCollector,
  MG: MgNfCollector,
};

function priorityStates() {
  return String(env.NF_PRIORITY_STATES || "SP,MG")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * @param {{ accessKey: string, stateCode: string, qrContent?: string|null }} input
 */
async function collectNfItems(input) {
  const stateCode = String(input.stateCode || "").toUpperCase();
  const allowed = priorityStates();

  if (env.NF_MOCK_COLLECTOR === true || env.NF_MOCK_COLLECTOR === "true") {
    return {
      items: [
        { name: "Arroz tipo 1", quantity: 1, unit: "kg", unitPrice: 6.49, sortOrder: 0 },
        { name: "Leite integral", quantity: 2, unit: "un", unitPrice: 4.99, sortOrder: 1 },
        { name: "Feijão carioca", quantity: 1, unit: "kg", unitPrice: 7.29, sortOrder: 2 },
      ],
      storeName: "Mercado (mock NF-e)",
      consultaUrl: null,
      collector: "mock",
      stateCode,
    };
  }

  if (!allowed.includes(stateCode)) {
    throw new AppError(
      `Ainda não lemos o QR de notas de ${stateCode || "esta UF"}. Por enquanto: ${allowed.join(", ")}. Use a foto da nota.`,
      422,
      { code: "nf_uf_unsupported", stateCode, supported: allowed, fallback: "photo" },
    );
  }

  const Collector = COLLECTORS[stateCode];
  if (!Collector) {
    throw new AppError(
      `UF ${stateCode} ainda sem adapter de QR. Use a foto da nota.`,
      422,
      { code: "nf_uf_unsupported", stateCode, fallback: "photo" },
    );
  }

  const result = await Collector.collect(input);
  return { ...result, stateCode };
}

module.exports = {
  collectNfItems,
  priorityStates,
};
