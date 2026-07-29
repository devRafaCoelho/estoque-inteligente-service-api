const db = require("../config/db");
const AppError = require("../utils/AppError");
const StockOutRepository = require("../repositories/StockOutRepository");
const StockOutItemRepository = require("../repositories/StockOutItemRepository");
const ProductRepository = require("../repositories/ProductRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const { StockOutDetailDto } = require("../dto/v1/stockOutDto");
const { ProductListDto } = require("../dto/v1/productDto");
const { assertDraftDocument } = require("../utils/draftDocument");
const StockMonitorService = require("./StockMonitorService");
const ConsumptionEstimateService = require("./ConsumptionEstimateService");

const StockOutConfirmService = {
  async confirm(userId, stockOutId, body) {
    return db.withTransaction(async (client) => {
      const stockOut = await StockOutRepository.findById(userId, stockOutId, client);
      assertDraftDocument(
        stockOut,
        "Baixa não encontrada",
        "Esta baixa já foi confirmada ou cancelada",
      );

      const activeItems = (body.items || []).filter((item) => !item.excluded);
      if (!activeItems.length) {
        throw new AppError("Selecione ao menos um item para confirmar", 400);
      }

      await StockOutItemRepository.replaceAll(
        stockOutId,
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
        client,
      );

      const affectedProducts = [];

      for (const item of activeItems) {
        if (!item.productId) {
          throw new AppError(
            `Vincule um produto existente para "${item.name}" antes de confirmar`,
            400,
          );
        }

        const product = await ProductRepository.findById(userId, item.productId, client);
        if (!product) {
          throw new AppError(`Produto não encontrado: ${item.name}`, 404);
        }

        const before = Number(product.quantity);
        const qty = Number(item.quantity);
        let after = before - qty;

        if (qty > before) {
          if (!item.allowZero) {
            throw new AppError(
              `Quantidade de "${item.name}" (${qty}) maior que o estoque (${before}). Marque zerar ou reduza a quantidade.`,
              400,
            );
          }
          after = 0;
        }

        const movedQty = before - after;
        if (movedQty > 0) {
          await StockMovementRepository.create(
            {
              userId,
              productId: product.id,
              stockOutId,
              type: "out",
              quantity: movedQty,
              unit: item.unit || product.unit,
              quantityBefore: before,
              quantityAfter: after,
              note: "Baixa por texto",
            },
            client,
          );
        }

        let updated = await ProductRepository.setQuantity(
          userId,
          product.id,
          after,
          { consumed: movedQty > 0 },
          client,
        );
        if (movedQty > 0) {
          const withStats =
            await ConsumptionEstimateService.refreshProductConsumptionStats(
              userId,
              product.id,
              client,
            );
          if (withStats) updated = withStats;
        }
        affectedProducts.push(ProductListDto(updated));
      }

      const confirmed = await StockOutRepository.updateStatus(
        userId,
        stockOutId,
        "confirmed",
        { confirmedAt: new Date() },
        client,
      );
      const items = await StockOutItemRepository.listByStockOut(stockOutId, client);

      return {
        stockOut: StockOutDetailDto(confirmed, items),
        products: affectedProducts,
      };
    }).then((result) => {
      StockMonitorService.evaluateUserSafe(userId);
      return result;
    });
  },
};

module.exports = StockOutConfirmService;
