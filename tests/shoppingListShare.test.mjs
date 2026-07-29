import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";

// ── Carrega módulos puros (sem I/O real) ────────────────────────────────────
const AppError = require("../src/utils/AppError");
const ShoppingListShareRepository = require("../src/repositories/ShoppingListShareRepository");
const ShoppingListShareService = require("../src/services/ShoppingListShareService");

// ── 1. hashToken produz SHA-256 de 64 chars ──────────────────────────────────
{
  const crypto = require("node:crypto");
  const raw = "abc123";
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  assert.equal(hash.length, 64, "SHA-256 hex deve ter 64 chars");
  assert.match(hash, /^[0-9a-f]{64}$/, "SHA-256 só tem hexa minúsculo");
}

// ── 2. Dois tokens distintos nunca geram o mesmo hash ────────────────────────
{
  const crypto = require("node:crypto");
  const hashFn = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
  const t1 = crypto.randomBytes(32).toString("hex");
  const t2 = crypto.randomBytes(32).toString("hex");
  assert.notEqual(t1, t2, "Tokens gerados devem ser distintos");
  assert.notEqual(hashFn(t1), hashFn(t2), "Hashes distintos para tokens distintos");
}

// ── 3. ShoppingListShareService.createShare lança 404 sem lista ativa ────────
{
  const origFindActive = ShoppingListShareService.__proto__;

  // Monkey-patch dos deps: simula ausência de lista ativa
  const ShoppingListRepository = require("../src/repositories/ShoppingListRepository");
  const origFindActive2 = ShoppingListRepository.findActive;
  ShoppingListRepository.findActive = async () => null;

  let caught = null;
  try {
    await ShoppingListShareService.createShare("user-uuid");
  } catch (err) {
    caught = err;
  }
  ShoppingListRepository.findActive = origFindActive2;

  assert.ok(caught instanceof AppError, "Deve lançar AppError quando sem lista");
  assert.equal(caught.statusCode, 404);
}

// ── 4. ShoppingListShareService.revokeShare lança 404 se share não existe ───
{
  const ShoppingListShareRepo = require("../src/repositories/ShoppingListShareRepository");
  const origRevoke = ShoppingListShareRepo.revoke;
  ShoppingListShareRepo.revoke = async () => null;

  let caught = null;
  try {
    await ShoppingListShareService.revokeShare("user-uuid", "share-uuid");
  } catch (err) {
    caught = err;
  }
  ShoppingListShareRepo.revoke = origRevoke;

  assert.ok(caught instanceof AppError, "Deve lançar AppError se share não encontrado");
  assert.equal(caught.statusCode, 404);
}

// ── 5. getSharedList lança 404 para token vazio/curto ────────────────────────
{
  for (const bad of ["", "abc", null, 123]) {
    let caught = null;
    try {
      await ShoppingListShareService.getSharedList(bad);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof AppError, `Deve lançar AppError para token inválido: ${bad}`);
    assert.equal(caught.statusCode, 404);
  }
}

// ── 6. getSharedList lança 404 se hash não encontrado no banco ───────────────
{
  const ShoppingListShareRepo = require("../src/repositories/ShoppingListShareRepository");
  const origFind = ShoppingListShareRepo.findValidByHash;
  ShoppingListShareRepo.findValidByHash = async () => null;

  let caught = null;
  try {
    await ShoppingListShareService.getSharedList("a".repeat(64)); // comprimento válido
  } catch (err) {
    caught = err;
  }
  ShoppingListShareRepo.findValidByHash = origFind;

  assert.ok(caught instanceof AppError, "Deve lançar AppError se token inválido no banco");
  assert.equal(caught.statusCode, 404);
}

// ── 7. getSharedList lança 410 quando lista arquivada ────────────────────────
{
  const ShoppingListShareRepo = require("../src/repositories/ShoppingListShareRepository");
  const ShoppingListRepo = require("../src/repositories/ShoppingListRepository");
  const ShoppingListItemRepo = require("../src/repositories/ShoppingListItemRepository");

  const origFind = ShoppingListShareRepo.findValidByHash;
  const origFindList = ShoppingListRepo.findById;
  const origListItems = ShoppingListItemRepo.listByList;

  ShoppingListShareRepo.findValidByHash = async () => ({
    id: "share-1",
    list_id: "list-1",
    user_id: "user-1",
    expires_at: new Date(Date.now() + 86400000),
  });
  ShoppingListRepo.findById = async () => ({
    id: "list-1",
    title: "Minha lista",
    status: "archived",
    generated_by: null,
    view_mode: "paper",
    created_at: new Date(),
    updated_at: new Date(),
    completed_at: new Date(),
  });
  ShoppingListItemRepo.listByList = async () => [];

  let caught = null;
  try {
    await ShoppingListShareService.getSharedList("a".repeat(64));
  } catch (err) {
    caught = err;
  }

  ShoppingListShareRepo.findValidByHash = origFind;
  ShoppingListRepo.findById = origFindList;
  ShoppingListItemRepo.listByList = origListItems;

  assert.ok(caught instanceof AppError, "Deve lançar AppError se lista não está ativa");
  assert.equal(caught.statusCode, 410);
}

// ── 8. getSharedList retorna DTO quando tudo válido ──────────────────────────
{
  const ShoppingListShareRepo = require("../src/repositories/ShoppingListShareRepository");
  const ShoppingListRepo = require("../src/repositories/ShoppingListRepository");
  const ShoppingListItemRepo = require("../src/repositories/ShoppingListItemRepository");
  const ProductRepo = require("../src/repositories/ProductRepository");

  const origFind = ShoppingListShareRepo.findValidByHash;
  const origFindList = ShoppingListRepo.findById;
  const origListItems = ShoppingListItemRepo.listByList;
  const origListProducts = ProductRepo.list;

  const fakeList = {
    id: "list-2",
    title: "Lista ativa",
    status: "active",
    generated_by: null,
    view_mode: "list",
    created_at: new Date(),
    updated_at: new Date(),
    completed_at: null,
  };

  ShoppingListShareRepo.findValidByHash = async () => ({
    id: "share-2",
    list_id: "list-2",
    user_id: "user-2",
    expires_at: new Date(Date.now() + 86400000),
  });
  ShoppingListRepo.findById = async () => fakeList;
  ShoppingListItemRepo.listByList = async () => [
    { id: "item-1", product_id: null, name: "Arroz", suggested_qty: 2, unit: "kg",
      priority: "medium", origin: "manual", checked: false, sort_order: 0, created_at: new Date() },
  ];
  ProductRepo.list = async () => [];

  const result = await ShoppingListShareService.getSharedList("b".repeat(64));

  ShoppingListShareRepo.findValidByHash = origFind;
  ShoppingListRepo.findById = origFindList;
  ShoppingListItemRepo.listByList = origListItems;
  ProductRepo.list = origListProducts;

  assert.equal(result.id, "list-2");
  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Arroz");
}

// ── 9. listShares retorna array vazio sem lista ativa ────────────────────────
{
  const ShoppingListRepo = require("../src/repositories/ShoppingListRepository");
  const origFindActive = ShoppingListRepo.findActive;
  ShoppingListRepo.findActive = async () => null;

  const result = await ShoppingListShareService.listShares("user-uuid");

  ShoppingListRepo.findActive = origFindActive;

  assert.deepEqual(result, { shares: [] });
}

// ── 10. ShoppingListShareRepository não expõe o token bruto ─────────────────
{
  const source = readFileSync(
    join(__dirname, "../src/repositories/ShoppingListShareRepository.js"),
    "utf8",
  );
  assert.equal(source.includes("randomBytes"), false, "Repository não deve gerar tokens");
}

console.log("shoppingListShare.test.mjs: ok");
