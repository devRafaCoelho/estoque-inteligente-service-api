const db = require("../config/db");
const AppError = require("../utils/AppError");
const AiParseService = require("./AiParseService");
const ProductMatcherService = require("./ProductMatcherService");
const ProductRepository = require("../repositories/ProductRepository");
const StockIntakeRepository = require("../repositories/StockIntakeRepository");
const StockIntakeItemRepository = require("../repositories/StockIntakeItemRepository");
const { IntakeDetailDto } = require("../dto/v1/intakeDto");

async function loadDetail(userId, intakeId, client = db) {
  const intake = await StockIntakeRepository.findById(userId, intakeId, client);
  if (!intake) throw new AppError("Entrada não encontrada", 404);
  const items = await StockIntakeItemRepository.listByIntake(intakeId, client);
  return IntakeDetailDto(intake, items);
}

const IntakeService = {
  async parseNaturalLanguage(userId, text) {
    const products = await ProductRepository.list(userId, { active: true });
    const productHints = products.slice(0, 40).map((p) => p.name);

    const parsed = await AiParseService.parseIntake(text, { productHints });

    return db.withTransaction(async (client) => {
      const matched = await ProductMatcherService.matchItems(userId, parsed.items, client);

      const intake = await StockIntakeRepository.create(
        {
          userId,
          source: "natural_language",
          status: "draft",
          rawInput: text,
          rawPayload: {
            parser: parsed.parser || "heuristic",
            action: parsed.action,
            modelItems: parsed.items,
            aiConfigured: AiParseService.isConfigured(),
          },
        },
        client,
      );

      const items = await StockIntakeItemRepository.createMany(intake.id, matched, client);
      return IntakeDetailDto(intake, items);
    });
  },

  async get(userId, intakeId) {
    return loadDetail(userId, intakeId);
  },

  async update(userId, intakeId, body) {
    const intake = await StockIntakeRepository.findById(userId, intakeId);
    if (!intake) throw new AppError("Entrada não encontrada", 404);
    if (intake.status !== "draft") {
      throw new AppError("Só é possível editar entradas em rascunho", 400);
    }

    return db.withTransaction(async (client) => {
      const rawPayload = {
        ...(intake.raw_payload || {}),
        storeName: body.storeName || null,
      };
      await StockIntakeRepository.updateRawPayload(userId, intakeId, rawPayload, client);

      const items = await StockIntakeItemRepository.replaceAll(
        intakeId,
        body.items.map((item, index) => ({
          productId: item.productId || null,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category || "other",
          unitPrice: item.unitPrice ?? null,
          confidence: item.confidence ?? null,
          matchedExisting: Boolean(item.productId || item.matchedExisting),
          excluded: Boolean(item.excluded),
          sortOrder: item.sortOrder ?? index,
        })),
        client,
      );

      const updated = await StockIntakeRepository.findById(userId, intakeId, client);
      return IntakeDetailDto(updated, items);
    });
  },

  async cancel(userId, intakeId) {
    const intake = await StockIntakeRepository.findById(userId, intakeId);
    if (!intake) throw new AppError("Entrada não encontrada", 404);
    if (intake.status !== "draft") {
      throw new AppError("Só é possível cancelar entradas em rascunho", 400);
    }
    const cancelled = await StockIntakeRepository.updateStatus(userId, intakeId, "cancelled");
    const items = await StockIntakeItemRepository.listByIntake(intakeId);
    return IntakeDetailDto(cancelled, items);
  },
};

module.exports = IntakeService;
