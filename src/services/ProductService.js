const AppError = require("../utils/AppError");
const ProductRepository = require("../repositories/ProductRepository");
const StockMovementRepository = require("../repositories/StockMovementRepository");
const StockMonitorService = require("./StockMonitorService");
const { ProductListDto, ProductDetailDto } = require("../dto/v1/productDto");
const db = require("../config/db");

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

  /**
   * Cria vários produtos. Sucesso parcial: itens inválidos/duplicados
   * vão em `errors`; os demais em `created`.
   */
  async createBatch(userId, products) {
    const created = [];
    const errors = [];
    const seenNames = new Set();

    for (let index = 0; index < products.length; index += 1) {
      const data = products[index];
      const nameKey = String(data.name || "")
        .trim()
        .toLowerCase();

      if (!nameKey) {
        errors.push({ index, name: data.name || "", error: "Informe o nome" });
        continue;
      }

      if (seenNames.has(nameKey)) {
        errors.push({
          index,
          name: data.name,
          error: "Nome duplicado nesta lista",
        });
        continue;
      }
      seenNames.add(nameKey);

      try {
        const product = await this.create(userId, data);
        created.push(product);
      } catch (err) {
        errors.push({
          index,
          name: data.name,
          error: err.message || "Erro ao criar produto",
        });
      }
    }

    if (created.length) {
      StockMonitorService.evaluateUserSafe(userId);
    }

    return {
      created,
      errors,
      createdCount: created.length,
      errorCount: errors.length,
    };
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
    }).then(async (result) => {
      StockMonitorService.evaluateUserSafe(userId);
      return result;
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
    }).then(async (result) => {
      StockMonitorService.evaluateUserSafe(userId);
      return result;
    });
  },
};

module.exports = ProductService;
