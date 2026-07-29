import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";

const AppError = require("../src/utils/AppError");
const {
  SharedShoppingListDto,
  SharedShoppingListItemDto,
} = require("../src/dto/v1/shoppingListDto");
const ShoppingListShareService = require("../src/services/ShoppingListShareService");
const ShoppingListShareRepository = require("../src/repositories/ShoppingListShareRepository");
const ShoppingListRepository = require("../src/repositories/ShoppingListRepository");

const FORBIDDEN_LIST_KEYS = [
  "userId",
  "user_id",
  "generatedBy",
  "viewMode",
  "id",
  "status",
  "createdAt",
  "updatedAt",
  "completedAt",
];

const FORBIDDEN_ITEM_KEYS = [
  "productId",
  "product_id",
  "origin",
  "sortOrder",
  "createdAt",
];

const FORBIDDEN_SPEND_KEYS = [
  "unpricedItems",
  "canSetPrice",
  "pricedItemCount",
  "unpricedItemCount",
];

// ── F3-3.3 DTO público só com campos permitidos ─────────────────────────────
{
  const dto = SharedShoppingListDto(
    { title: "Lista de compras", id: "secret-list-id", user_id: "owner-uuid" },
    [
      {
        id: "i1",
        product_id: "p-secret",
        name: "Arroz",
        suggested_qty: 2,
        unit: "kg",
        priority: "high",
        origin: "ai",
        checked: false,
        sort_order: 0,
        created_at: new Date(),
      },
      {
        id: "i2",
        product_id: "p-other",
        name: "Leite",
        suggested_qty: 1,
        unit: "l",
        priority: "low",
        origin: "manual",
        checked: true,
        sort_order: 1,
        created_at: new Date(),
      },
    ],
    {
      hasEstimate: true,
      estimatedTotal: 20,
      isPartial: true,
      currency: "BRL",
      pricedItemCount: 1,
      unpricedItemCount: 1,
      unpricedItems: [{ productId: "p-secret", canSetPrice: true, name: "Arroz" }],
    },
  );

  for (const key of FORBIDDEN_LIST_KEYS) {
    assert.equal(Object.hasOwn(dto, key), false, `DTO não deve expor ${key}`);
  }
  assert.equal(dto.title, "Lista de compras");
  assert.ok(Array.isArray(dto.items));
  assert.equal(dto.items.length, 2);
  // pendentes com prioridade high primeiro
  assert.equal(dto.items[0].name, "Arroz");
  assert.equal(dto.items[0].checked, false);
  assert.equal(dto.items[1].checked, true);

  for (const item of dto.items) {
    for (const key of FORBIDDEN_ITEM_KEYS) {
      assert.equal(Object.hasOwn(item, key), false, `item não deve expor ${key}`);
    }
    assert.ok(item.name);
    assert.ok(item.id);
  }

  assert.ok(dto.spendEstimate);
  for (const key of FORBIDDEN_SPEND_KEYS) {
    assert.equal(
      Object.hasOwn(dto.spendEstimate, key),
      false,
      `spendEstimate não deve expor ${key}`,
    );
  }
  assert.equal(dto.spendEstimate.estimatedTotal, 20);
  assert.equal(dto.spendEstimate.hasEstimate, true);
}

{
  const item = SharedShoppingListItemDto({
    id: "x",
    product_id: "hidden",
    name: "Feijão",
    suggested_qty: 1,
    unit: "kg",
    priority: "medium",
    origin: "manual",
    checked: false,
  });
  assert.deepEqual(Object.keys(item).sort(), [
    "checked",
    "id",
    "name",
    "priority",
    "suggestedQty",
    "unit",
  ]);
}

// ── F3-3.4 público: só PATCH de checked; sem mutação de estoque ─────────────
{
  const routesSource = readFileSync(
    join(__dirname, "../src/routes/shoppingListShareRoutes.js"),
    "utf8",
  );
  assert.match(routesSource, /router\.get\(\s*["']\/public\/:token["']/);
  assert.match(routesSource, /router\.patch\(\s*["']\/public\/:token\/items\/:itemId["']/);
  assert.equal(routesSource.includes("stock"), false);
  assert.equal(routesSource.includes("intake"), false);

  const serviceSource = readFileSync(
    join(__dirname, "../src/services/ShoppingListShareService.js"),
    "utf8",
  );
  assert.ok(serviceSource.includes("updateSharedItem"));
  // updateSharedItem só mexe em checked
  assert.match(serviceSource, /update\(itemId,\s*\{\s*checked\s*\}/);
}

// ── F3-3.4 revoke: não-dono → 403 ───────────────────────────────────────────
{
  const origFind = ShoppingListShareRepository.findById;
  const origRevoke = ShoppingListShareRepository.revoke;
  ShoppingListShareRepository.findById = async () => ({
    id: "share-1",
    user_id: "owner-id",
    revoked_at: null,
  });
  ShoppingListShareRepository.revoke = async () => {
    throw new Error("revoke não deveria ser chamado para não-dono");
  };

  let caught = null;
  try {
    await ShoppingListShareService.revokeShare("other-user", "share-1");
  } catch (err) {
    caught = err;
  }
  ShoppingListShareRepository.findById = origFind;
  ShoppingListShareRepository.revoke = origRevoke;

  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 403);
}

// ── F3-3.4 revoke: inexistente → 404 ────────────────────────────────────────
{
  const origFind = ShoppingListShareRepository.findById;
  ShoppingListShareRepository.findById = async () => null;
  let caught = null;
  try {
    await ShoppingListShareService.revokeShare("user", "missing");
  } catch (err) {
    caught = err;
  }
  ShoppingListShareRepository.findById = origFind;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 404);
}

// ── F3-3.4 após revogar, getSharedList falha (hash inválido) ─────────────────
{
  const origFind = ShoppingListShareRepository.findValidByHash;
  ShoppingListShareRepository.findValidByHash = async () => null;
  let caught = null;
  try {
    await ShoppingListShareService.getSharedList("a".repeat(64));
  } catch (err) {
    caught = err;
  }
  ShoppingListShareRepository.findValidByHash = origFind;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 404);
}

// ── F3-3.4 createShare: lista de outro user → 403 ───────────────────────────
{
  const origFind = ShoppingListRepository.findActive;
  ShoppingListRepository.findActive = async () => ({
    id: "list-1",
    user_id: "someone-else",
    status: "active",
  });
  let caught = null;
  try {
    await ShoppingListShareService.createShare("me");
  } catch (err) {
    caught = err;
  }
  ShoppingListRepository.findActive = origFind;
  assert.ok(caught instanceof AppError);
  assert.equal(caught.statusCode, 403);
}

console.log("shoppingListSharePrivacy.test.mjs: ok");
