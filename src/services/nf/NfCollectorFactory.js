const env = require("../../config/env");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const NfCollectorLogRepository = require("../../repositories/NfCollectorLogRepository");
const { listCoverage } = require("./nfCoverage");
const {
  SpNfCollector,
  MgNfCollector,
  BaNfCollector,
  RjNfCollector,
  PrNfCollector,
} = require("./collectors");

/** Registry incremental: novas UFs entram aqui + em NF_PRIORITY_STATES. */
const COLLECTORS = {
  SP: SpNfCollector,
  MG: MgNfCollector,
  BA: BaNfCollector,
  RJ: RjNfCollector,
  PR: PrNfCollector,
};

function priorityStates() {
  return String(env.NF_PRIORITY_STATES || "SP,MG,BA,RJ,PR")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function supportedStateCodes() {
  return priorityStates().filter((code) => Boolean(COLLECTORS[code]));
}

function getCoverage() {
  const priority = priorityStates();
  return {
    priorityStates: priority,
    supportedStates: supportedStateCodes(),
    states: listCoverage(priority),
  };
}

async function safeLog(entry) {
  try {
    await NfCollectorLogRepository.create(entry);
  } catch (err) {
    logger.warn("Falha ao gravar nf_collector_logs", { message: err.message });
  }
}

/**
 * @param {{ accessKey: string, stateCode: string, qrContent?: string|null }} input
 * @param {{ userId?: string|null }} [ctx]
 */
async function collectNfItems(input, ctx = {}) {
  const stateCode = String(input.stateCode || "").toUpperCase();
  const allowed = priorityStates();
  const userId = ctx.userId || null;

  if (env.NF_MOCK_COLLECTOR === true || env.NF_MOCK_COLLECTOR === "true") {
    const mock = {
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
    await safeLog({
      userId,
      stateCode,
      accessKey: input.accessKey,
      success: true,
      metadata: { collector: "mock" },
    });
    return mock;
  }

  if (!allowed.includes(stateCode)) {
    const supported = supportedStateCodes();
    const err = new AppError(
      `Ainda não lemos o QR de notas de ${stateCode || "esta UF"}. Por enquanto: ${supported.join(", ") || allowed.join(", ")}. Use a foto da nota.`,
      422,
      {
        code: "nf_uf_unsupported",
        stateCode,
        supported,
        fallback: "photo",
      },
    );
    await safeLog({
      userId,
      stateCode,
      accessKey: input.accessKey,
      success: false,
      errorMessage: err.message,
      metadata: { code: "nf_uf_unsupported" },
    });
    throw err;
  }

  const Collector = COLLECTORS[stateCode];
  if (!Collector) {
    const supported = supportedStateCodes();
    const err = new AppError(
      `UF ${stateCode} ainda sem adapter de QR. Use a foto da nota.`,
      422,
      { code: "nf_uf_unsupported", stateCode, supported, fallback: "photo" },
    );
    await safeLog({
      userId,
      stateCode,
      accessKey: input.accessKey,
      success: false,
      errorMessage: err.message,
      metadata: { code: "nf_uf_unsupported", reason: "no_adapter" },
    });
    throw err;
  }

  try {
    const result = await Collector.collect({ ...input, stateCode });
    await safeLog({
      userId,
      stateCode,
      accessKey: input.accessKey,
      sourceUrl: result.consultaUrl || null,
      success: true,
      metadata: {
        collector: result.collector || stateCode,
        itemCount: (result.items || []).length,
      },
    });
    return { ...result, stateCode };
  } catch (err) {
    const code = err instanceof AppError ? err.details?.code : "nf_collector_failed";
    await safeLog({
      userId,
      stateCode,
      accessKey: input.accessKey,
      sourceUrl: err instanceof AppError ? err.details?.consultaUrl || null : null,
      success: false,
      errorMessage: err.message,
      metadata: { code },
    });
    throw err;
  }
}

module.exports = {
  collectNfItems,
  priorityStates,
  supportedStateCodes,
  getCoverage,
  COLLECTORS,
};
