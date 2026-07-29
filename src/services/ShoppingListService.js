const db = require("../config/db");
const AppError = require("../utils/AppError");
const AiParseService = require("./AiParseService");
const ProductRepository = require("../repositories/ProductRepository");
const ShoppingListRepository = require("../repositories/ShoppingListRepository");
const ShoppingListItemRepository = require("../repositories/ShoppingListItemRepository");
const UserPreferencesRepository = require("../repositories/UserPreferencesRepository");
const { ShoppingListDto, ShoppingListItemDto } = require("../dto/v1/shoppingListDto");
const { normalizeUnit } = require("./parsers/textIntakeParser");
const { resolveShoppingListOrigin } = require("../utils/stockRules");
const { estimateShoppingListSpend } = require("../utils/shoppingListSpend");
const { productHintsFrom } = require("../utils/productHints");

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function normalizeItemName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function itemMatchKey(name, unit) {
  return `${normalizeItemName(name)}::${normalizeUnit(unit) || "un"}`;
}

function sumSuggestedQty(a, b) {
  const hasA = a != null && a !== "" && !Number.isNaN(Number(a));
  const hasB = b != null && b !== "" && !Number.isNaN(Number(b));
  if (!hasA && !hasB) return null;
  return (hasA ? Number(a) : 0) + (hasB ? Number(b) : 0);
}

function preferPriority(a, b) {
  return PRIORITY_RANK[a] <= PRIORITY_RANK[b] ? a : b;
}

/** Agrupa itens iguais no próprio lote (nome + unidade). */
function collapseIncomingItems(items) {
  const map = new Map();
  for (const item of items) {
    const unit = normalizeUnit(item.unit) || item.unit || "un";
    const key = itemMatchKey(item.name, unit);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...item, unit });
      continue;
    }
    prev.suggestedQty = sumSuggestedQty(prev.suggestedQty, item.suggestedQty);
    prev.priority = preferPriority(prev.priority || "medium", item.priority || "medium");
    if (!prev.productId && item.productId) prev.productId = item.productId;
  }
  return Array.from(map.values());
}

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
    const resolved = resolveShoppingListOrigin(product, now);
    if (!resolved) continue;

    const { origin, priority } = resolved;
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

  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter(Boolean)),
  ];
  const products =
    productIds.length > 0
      ? await ProductRepository.list(userId, { active: true }, client)
      : [];
  const productsById = new Map(products.map((product) => [product.id, product]));
  const spendEstimate = estimateShoppingListSpend(items, productsById, {
    onlyPending: true,
  });

  return ShoppingListDto(list, items, viewMode, spendEstimate);
}

/**
 * Calcula sugestões automáticas que ainda não estão na lista (sem gravar).
 */
async function collectSuggestionsToAdd(userId, client = db) {
  const list = await ensureActiveList(userId, client);
  const products = await ProductRepository.list(userId, { active: true }, client);
  const suggestions = buildRuleSuggestions(products);
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

  return { list, current, suggestions, toAdd };
}

const ShoppingListService = {
  async getActive(userId) {
    return loadDetail(userId);
  },

  /**
   * Prévia das sugestões (rules) sem alterar a lista.
   */
  async previewSuggestions(userId, { mode = "rules" } = {}) {
    if (mode !== "rules") {
      throw new AppError("Nesta versão só o modo rules está disponível", 400);
    }
    const { current, toAdd } = await collectSuggestionsToAdd(userId);
    const pending = current.filter((row) => !row.checked);
    return {
      mode: "rules",
      newCount: toAdd.length,
      newSuggestions: toAdd.map((item) => ({
        name: item.name,
        suggestedQty: item.suggestedQty,
        unit: item.unit,
        priority: item.priority,
        origin: item.origin,
      })),
      pendingCount: pending.length,
      pendingNames: pending.slice(0, 8).map((row) => row.name),
    };
  },

  async generate(userId, { mode = "rules" } = {}) {
    if (mode !== "rules") {
      throw new AppError("Nesta versão só o modo rules está disponível", 400);
    }

    return db.withTransaction(async (client) => {
      const list = await ensureActiveList(userId, client);
      await ShoppingListItemRepository.deleteUncheckedAuto(list.id, client);
      const { toAdd } = await collectSuggestionsToAdd(userId, client);

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
          const productHints = productHintsFrom(products);
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

      toCreate = collapseIncomingItems(toCreate);

      if (!toCreate.length || !toCreate[0].name) {
        throw new AppError("Informe o que deseja adicionar à lista", 422);
      }

      const current = await ShoppingListItemRepository.listByList(list.id, client);
      const uncheckedByKey = new Map();
      for (const row of current) {
        if (row.checked) continue;
        const key = itemMatchKey(row.name, row.unit);
        if (!uncheckedByKey.has(key)) uncheckedByKey.set(key, row);
      }

      const created = [];
      const updated = [];

      for (const item of toCreate) {
        const key = itemMatchKey(item.name, item.unit);
        const existing = uncheckedByKey.get(key);
        if (existing) {
          const nextQty = sumSuggestedQty(existing.suggested_qty, item.suggestedQty);
          const nextPriority = preferPriority(
            existing.priority || "medium",
            item.priority || "medium",
          );
          const row = await ShoppingListItemRepository.update(
            existing.id,
            {
              suggestedQty: nextQty,
              priority: nextPriority,
              ...(item.productId && !existing.product_id
                ? { productId: item.productId }
                : {}),
              unit: normalizeUnit(existing.unit) || existing.unit || item.unit,
            },
            client,
          );
          updated.push(row);
          uncheckedByKey.set(key, row);
        } else {
          const [row] = await ShoppingListItemRepository.createMany(list.id, [item], client);
          created.push(row);
          uncheckedByKey.set(key, row);
        }
      }

      await ShoppingListRepository.touch(userId, list.id, {}, client);
      const detail = await loadDetail(userId, client);
      return {
        items: [...updated, ...created].map(ShoppingListItemDto),
        item: ShoppingListItemDto((created[0] || updated[0])),
        createdCount: created.length,
        updatedCount: updated.length,
        list: detail,
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

  async clearItems(userId) {
    const list = await ensureActiveList(userId);
    await ShoppingListItemRepository.deleteAllByList(list.id);
    await ShoppingListRepository.touch(userId, list.id, {});
    return loadDetail(userId);
  },

  async setViewMode(userId, viewMode) {
    await UserPreferencesRepository.createDefaults(userId);
    await UserPreferencesRepository.updateViewMode(userId, viewMode);
    return loadDetail(userId);
  },
};

module.exports = ShoppingListService;
