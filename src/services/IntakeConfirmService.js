const db = require("../config/db");
const AppError = require("../utils/AppError");
const StockIntakeRepository = require("../repositories/StockIntakeRepository");
const StockIntakeItemRepository = require("../repositories/StockIntakeItemRepository");
const ProductRepository = require("../repositories/ProductRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const { IntakeDetailDto } = require("../dto/v1/intakeDto");
const { ProductListDto } = require("../dto/v1/productDto");
const StockMonitorService = require("./StockMonitorService");

const IntakeConfirmService = {
  async confirm(userId, intakeId, body) {
    return db.withTransaction(async (client) => {
      const intake = await StockIntakeRepository.findById(userId, intakeId, client);
      if (!intake) throw new AppError("Entrada não encontrada", 404);
      if (intake.status !== "draft") {
        throw new AppError("Esta entrada já foi confirmada ou cancelada", 400);
      }

      const activeItems = (body.items || []).filter((item) => !item.excluded);
      if (!activeItems.length) {
        throw new AppError("Selecione ao menos um item para confirmar", 400);
      }

      // Persiste edição final no draft antes de aplicar estoque
      await StockIntakeItemRepository.replaceAll(
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

      if (body.storeName !== undefined) {
        await StockIntakeRepository.updateRawPayload(
          userId,
          intakeId,
          { ...(intake.raw_payload || {}), storeName: body.storeName || null },
          client,
        );
      }

      const affectedProducts = [];

      for (const item of activeItems) {
        let product = null;

        if (item.productId) {
          product = await ProductRepository.findById(userId, item.productId, client);
          if (!product) {
            throw new AppError(`Produto vinculado não encontrado: ${item.name}`, 404);
          }
        } else {
          product = await ProductRepository.findByName(userId, item.name, client);
        }

        const qty = Number(item.quantity);
        const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : null;

        if (!product) {
          product = await ProductRepository.create(
            userId,
            {
              name: item.name,
              category: item.category || "other",
              quantity: qty,
              unit: item.unit,
              minQuantity: 1,
              avgUnitPrice: unitPrice,
            },
            client,
          );

          await StockMovementRepository.create(
            {
              userId,
              productId: product.id,
              intakeId,
              type: "in",
              quantity: qty,
              unit: item.unit,
              quantityBefore: 0,
              quantityAfter: qty,
              note: "Entrada por texto",
            },
            client,
          );
        } else {
          const before = Number(product.quantity);
          const after = before + qty;

          await StockMovementRepository.create(
            {
              userId,
              productId: product.id,
              intakeId,
              type: "in",
              quantity: qty,
              unit: item.unit || product.unit,
              quantityBefore: before,
              quantityAfter: after,
              note: "Entrada por texto",
            },
            client,
          );

          const avgUnitPrice =
            unitPrice != null
              ? unitPrice
              : product.avg_unit_price != null
                ? Number(product.avg_unit_price)
                : null;

          product = await ProductRepository.applyIntake(
            userId,
            product.id,
            {
              quantity: after,
              avgUnitPrice,
              unit: item.unit || product.unit,
              category: item.category || product.category,
            },
            client,
          );
        }

        affectedProducts.push(ProductListDto(product));
      }

      // Financeiro simples: só cria purchase se houver algum preço
      let purchase = null;
      const priced = activeItems.filter((item) => item.unitPrice != null);
      if (priced.length) {
        const total = priced.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
          0,
        );
        const { rows: purchaseRows } = await client.query(
          `INSERT INTO purchases (user_id, intake_id, store_name, purchased_at, total_amount)
           VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5)
           RETURNING *`,
          [
            userId,
            intakeId,
            body.storeName || null,
            body.purchasedAt || null,
            total,
          ],
        );
        purchase = purchaseRows[0];

        for (const item of priced) {
          const lineTotal = Number(item.quantity) * Number(item.unitPrice);
          await client.query(
            `INSERT INTO purchase_items
               (purchase_id, product_id, name, quantity, unit, unit_price, line_total, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              purchase.id,
              item.productId || null,
              item.name,
              item.quantity,
              item.unit,
              item.unitPrice,
              lineTotal,
              item.category || null,
            ],
          );
        }
      }

      const confirmed = await StockIntakeRepository.updateStatus(
        userId,
        intakeId,
        "confirmed",
        { confirmedAt: new Date() },
        client,
      );
      const items = await StockIntakeItemRepository.listByIntake(intakeId, client);

      return {
        intake: IntakeDetailDto(confirmed, items),
        products: affectedProducts,
        purchase: purchase
          ? {
              id: purchase.id,
              totalAmount: Number(purchase.total_amount),
              storeName: purchase.store_name,
              purchasedAt: purchase.purchased_at,
            }
          : null,
      };
    }).then((result) => {
      StockMonitorService.evaluateUserSafe(userId);
      return result;
    });
  },
};

module.exports = IntakeConfirmService;
