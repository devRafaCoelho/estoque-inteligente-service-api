const db = require("../config/db");
const AppError = require("../utils/AppError");
const ProductRepository = require("../repositories/ProductRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const { ProductListDto, ProductDetailDto } = require("../dto/v1/productDto");

const ProductService = {
  async list(userId, filters) {
    const rows = await ProductRepository.list(userId, filters);
    return rows.map(ProductListDto);
  },

  async get(userId, id) {
    const product = await ProductRepository.findById(userId, id);
    if (!product) throw new AppError("Produto não encontrado", 404);
    const movements = await StockMovementRepository.listByProduct(userId, id);
    return ProductDetailDto(product, movements);
  },

  async create(userId, data) {
    const existing = await ProductRepository.findByName(userId, data.name);
    if (existing) {
      throw new AppError("Já existe um produto com esse nome", 409);
    }

    const product = await db.withTransaction(async (client) => {
      const created = await ProductRepository.create(userId, data, client);
      if (Number(created.quantity) > 0) {
        await StockMovementRepository.create(
          {
            userId,
            productId: created.id,
            type: "in",
            quantity: Number(created.quantity),
            unit: created.unit,
            quantityBefore: 0,
            quantityAfter: Number(created.quantity),
            note: "Cadastro inicial",
          },
          client,
        );
      }
      return created;
    });

    return ProductDetailDto(product, []);
  },

  async update(userId, id, fields) {
    const product = await ProductRepository.findById(userId, id);
    if (!product) throw new AppError("Produto não encontrado", 404);

    const updated = await ProductRepository.update(userId, id, fields);
    const movements = await StockMovementRepository.listByProduct(userId, id);
    return ProductDetailDto(updated, movements);
  },

  async consume(userId, id, { quantity, note }) {
    return db.withTransaction(async (client) => {
      const product = await ProductRepository.findById(userId, id, client);
      if (!product) throw new AppError("Produto não encontrado", 404);

      const before = Number(product.quantity);
      if (quantity > before) {
        throw new AppError(
          `Quantidade a consumir (${quantity}) maior que o estoque atual (${before})`,
          400,
        );
      }
      const after = before - quantity;

      await StockMovementRepository.create(
        {
          userId,
          productId: id,
          type: "out",
          quantity,
          unit: product.unit,
          quantityBefore: before,
          quantityAfter: after,
          note: note || "Baixa manual",
        },
        client,
      );

      const updated = await ProductRepository.setQuantity(
        userId,
        id,
        after,
        { consumed: true },
        client,
      );
      return ProductListDto(updated);
    });
  },

  async markOut(userId, id) {
    return db.withTransaction(async (client) => {
      const product = await ProductRepository.findById(userId, id, client);
      if (!product) throw new AppError("Produto não encontrado", 404);

      const before = Number(product.quantity);
      if (before > 0) {
        await StockMovementRepository.create(
          {
            userId,
            productId: id,
            type: "out",
            quantity: before,
            unit: product.unit,
            quantityBefore: before,
            quantityAfter: 0,
            note: "Marcado como acabou",
          },
          client,
        );
      }

      const updated = await ProductRepository.setQuantity(
        userId,
        id,
        0,
        { consumed: before > 0 },
        client,
      );
      return ProductListDto(updated);
    });
  },
};

module.exports = ProductService;
