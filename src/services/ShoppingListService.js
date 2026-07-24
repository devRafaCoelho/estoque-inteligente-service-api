const db = require("../config/db");
const AppError = require("../utils/AppError");
const AiParseService = require("./AiParseService");
const ProductRepository = require("../repositories/ProductRepository");
const ShoppingListRepository = require("../repositories/ShoppingListRepository");
const ShoppingListItemRepository = require("../repositories/ShoppingListItemRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const { ShoppingListDto, ShoppingListItemDto } = require("../dto/v1/shoppingListDto");

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function suggestedQtyFor(product, origin) {
  const minQty = Number(product.min_quantity) || 1;
  const qty = Number(product.quantity) || 0;
  if (origin === "out_of_stock") return Math.max(minQty, 1);
  if (origin === "low_stock") return Math.max(minQty - qty, 1);
  return Math.max(minQty, 1);
}

function buildRuleSuggestions(products) {
  const now = Date.now();
  const byProduct = new Map();

  for (const product of products) {
    if (!product.active) continue;
    const qty = Number(product.quantity);
    const minQty = Number(product.min_quantity);
    let origin = null;
    let priority = "medium";

    if (qty <= 0) {
      origin = "out_of_stock";
      priority = "high";
    } else if (qty <= minQty) {
      origin = "low_stock";
      priority = "high";
    } else if (product.repurchase_days && product.last_purchased_at) {
      const dueAt =
        new Date(product.last_purchased_at).getTime() +
        Number(product.repurchase_days) * 24 * 60 * 60 * 1000;
      if (dueAt <= now) {
        origin = "repurchase_time";
        priority = "medium";
      }
    }

    if (!origin) continue;

    const candidate = {
      productId: product.id,
      name: product.name,
      suggestedQty: suggestedQtyFor(product, origin),
      unit: product.unit || "un",
      priority,
      origin,
      checked: false,
    };

    const existing = byProduct.get(product.id);
    if (!existing || PRIORITY_RANK[candidate.priority] < PRIORITY_RANK[existing.priority]) {
      byProduct.set(product.id, candidate);
    }
  }

  return Array.from(byProduct.values()).sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.name.localeCompare(b.name),
  );
}

async function ensureActiveList(userId, client = db) {
  let list = await ShoppingListRepository.findActive(userId, client);
  if (!list) {
    list = await ShoppingListRepository.create(userId, {}, client);
  }
  return list;
}

async function loadDetail(userId, client = db) {
  const list = await ensureActiveList(userId, client);
  const items = await ShoppingListItemRepository.listByList(list.id, client);
  const prefs = await UserPreferencesRepository.findByUser(userId, client);
  const viewMode = prefs?.shopping_list_view_mode === "list" ? "list" : "paper";
  return ShoppingListDto(list, items, viewMode);
}

const ShoppingListService = {
  async getActive(userId) {
    return loadDetail(userId);
  },

  async generate(userId, { mode = "rules" } = {}) {
    if (mode !== "rules") {
      throw new AppError("Nesta versão só o modo rules está disponível", 400);
    }

    return db.withTransaction(async (client) => {
      const list = await ensureActiveList(userId, client);
      const products = await ProductRepository.list(userId, { active: true }, client);
      const suggestions = buildRuleSuggestions(products);

      await ShoppingListItemRepository.deleteUncheckedAuto(list.id, client);
      const current = await ShoppingListItemRepository.listByList(list.id, client);
      const existingProductIds = new Set(
        current.filter((i) => i.product_id).map((i) => i.product_id),
      );
      const existingNames = new Set(current.map((i) => String(i.name).toLowerCase()));

      const toAdd = suggestions.filter((item) => {
        if (item.productId && existingProductIds.has(item.productId)) return false;
        if (existingNames.has(String(item.name).toLowerCase())) return false;
        return true;
      });

      if (toAdd.length) {
        await ShoppingListItemRepository.createMany(list.id, toAdd, client);
      }

      await ShoppingListRepository.touch(userId, list.id, { generatedBy: "rules" }, client);
      return loadDetail(userId, client);
    });
  },

  async addItem(userId, body) {
    return db.withTransaction(async (client) => {
      const list = await ensureActiveList(userId, client);
      let toCreate = [];

      const freeText = (body.text || "").trim() || (body.name || "").trim();
      const hasStructuredQty = body.suggestedQty != null;

      if (freeText && !hasStructuredQty) {
        try {
          const products = await ProductRepository.list(userId, { active: true }, client);
          const productHints = products.slice(0, 40).map((p) => p.name);
          const parsed = await AiParseService.parseIntake(freeText, { productHints });
          toCreate = parsed.items.map((item) => ({
            productId: body.productId || null,
            name: item.name,
            suggestedQty: item.quantity,
            unit: item.unit || "un",
            priority: body.priority || "medium",
            origin: "manual",
            checked: false,
          }));
        } catch (_err) {
          toCreate = [
            {
              productId: body.productId || null,
              name: freeText,
              suggestedQty: null,
              unit: body.unit || "un",
              priority: body.priority || "medium",
              origin: "manual",
              checked: false,
            },
          ];
        }
      } else {
        toCreate = [
          {
            productId: body.productId || null,
            name: body.name || freeText,
            suggestedQty: body.suggestedQty ?? null,
            unit: body.unit || "un",
            priority: body.priority || "medium",
            origin: "manual",
            checked: false,
          },
        ];
      }

      if (!toCreate.length || !toCreate[0].name) {
        throw new AppError("Informe o que deseja adicionar à lista", 422);
      }

      const created = await ShoppingListItemRepository.createMany(list.id, toCreate, client);
      await ShoppingListRepository.touch(userId, list.id, {}, client);
      return {
        items: created.map(ShoppingListItemDto),
        item: ShoppingListItemDto(created[0]),
      };
    });
  },

  async updateItem(userId, itemId, fields) {
    const existing = await ShoppingListItemRepository.findById(userId, itemId);
    if (!existing) throw new AppError("Item não encontrado", 404);
    const updated = await ShoppingListItemRepository.update(itemId, fields);
    await ShoppingListRepository.touch(userId, existing.shopping_list_id, {});
    return ShoppingListItemDto(updated);
  },

  async deleteItem(userId, itemId) {
    const existing = await ShoppingListItemRepository.findById(userId, itemId);
    if (!existing) throw new AppError("Item não encontrado", 404);
    await ShoppingListItemRepository.delete(itemId);
    await ShoppingListRepository.touch(userId, existing.shopping_list_id, {});
    return { deleted: true };
  },

  async setViewMode(userId, viewMode) {
    await UserPreferencesRepository.createDefaults(userId);
    await UserPreferencesRepository.updateViewMode(userId, viewMode);
    return loadDetail(userId);
  },
};

module.exports = ShoppingListService;
