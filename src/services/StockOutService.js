const db = require("../config/db");
const AppError = require("../utils/AppError");
const AiParseService = require("./AiParseService");
const ProductMatcherService = require("./ProductMatcherService");
const ProductRepository = require("../repositories/ProductRepository");
const StockOutRepository = require("../repositories/StockOutRepository");
const StockOutItemRepository = require("../repositories/StockOutItemRepository");
const { StockOutDetailDto } = require("../dto/v1/stockOutDto");

function enrichWarnings(items) {
  return items.map((item) => {
    let warning = null;
    if (!item.productId) warning = "product_not_found";
    else if (item.availableQty != null && item.quantity > item.availableQty) {
      warning = "exceeds_stock";
    }
    return { ...item, warning };
  });
}

async function matchConsumeItems(userId, items, client) {
  const matched = await ProductMatcherService.matchItems(userId, items, client);
  const products = await ProductRepository.list(userId, { active: true }, client);
  const byId = new Map(products.map((p) => [p.id, p]));

  return enrichWarnings(
    matched.map((item) => {
      const product = item.productId ? byId.get(item.productId) : null;
      return {
        ...item,
        availableQty: product ? Number(product.quantity) : null,
        unit: item.unit || product?.unit || "un",
      };
    }),
  );
}

async function loadDetail(userId, stockOutId, client = db) {
  const stockOut = await StockOutRepository.findById(userId, stockOutId, client);
  if (!stockOut) throw new AppError("Baixa não encontrada", 404);
  const items = await StockOutItemRepository.listByStockOut(stockOutId, client);
  return StockOutDetailDto(stockOut, items);
}

const StockOutService = {
  async parseNaturalLanguage(userId, text) {
    const products = await ProductRepository.list(userId, { active: true });
    const productHints = products.slice(0, 40).map((p) => p.name);
    const parsed = await AiParseService.parseConsume(text, { productHints });

    return db.withTransaction(async (client) => {
      const matchedItems = await matchConsumeItems(userId, parsed.items, client);
      const items = matchedItems.filter((item) => item.productId);

      if (!items.length) {
        throw new AppError(
          "Nenhum produto do texto foi encontrado no estoque. Confira os nomes e tente novamente.",
          422,
        );
      }

      const stockOut = await StockOutRepository.create(
        {
          userId,
          source: "natural_language",
          status: "draft",
          rawInput: text,
          rawPayload: {
            parser: parsed.parser || "heuristic",
            action: parsed.action,
            modelItems: parsed.items,
            matchedCount: items.length,
            unmatchedCount: matchedItems.length - items.length,
            aiConfigured: AiParseService.isConfigured(),
          },
        },
        client,
      );
      const createdItems = await StockOutItemRepository.createMany(stockOut.id, items, client);
      return StockOutDetailDto(stockOut, createdItems);
    });
  },

  async get(userId, stockOutId) {
    return loadDetail(userId, stockOutId);
  },

  async update(userId, stockOutId, body) {
    const stockOut = await StockOutRepository.findById(userId, stockOutId);
    if (!stockOut) throw new AppError("Baixa não encontrada", 404);
    if (stockOut.status !== "draft") {
      throw new AppError("Só é possível editar baixas em rascunho", 400);
    }

    return db.withTransaction(async (client) => {
      const enriched = enrichWarnings(
        body.items.map((item, index) => ({
          productId: item.productId || null,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          confidence: item.confidence ?? null,
          matchedExisting: Boolean(item.productId || item.matchedExisting),
          availableQty: item.availableQty ?? null,
          warning: item.warning || null,
          excluded: Boolean(item.excluded),
          sortOrder: item.sortOrder ?? index,
        })),
      );

      const items = await StockOutItemRepository.replaceAll(stockOutId, enriched, client);
      const updated = await StockOutRepository.findById(userId, stockOutId, client);
      return StockOutDetailDto(updated, items);
    });
  },

  async cancel(userId, stockOutId) {
    const stockOut = await StockOutRepository.findById(userId, stockOutId);
    if (!stockOut) throw new AppError("Baixa não encontrada", 404);
    if (stockOut.status !== "draft") {
      throw new AppError("Só é possível cancelar baixas em rascunho", 400);
    }
    const cancelled = await StockOutRepository.updateStatus(userId, stockOutId, "cancelled");
    const items = await StockOutItemRepository.listByStockOut(stockOutId);
    return StockOutDetailDto(cancelled, items);
  },
};

module.exports = StockOutService;
