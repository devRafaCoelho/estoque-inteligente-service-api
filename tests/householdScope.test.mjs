import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";

const {
  resolveScope,
  scopePredicate,
  appendScopeWhere,
} = require("../src/utils/resolveScope");
const HouseholdRepository = require("../src/repositories/HouseholdRepository");
const ProductRepository = require("../src/repositories/ProductRepository");

// ── scopePredicate: solo ─────────────────────────────────────────────────────
{
  const scope = { userId: "u-solo", householdId: null };
  const { clause, values, nextIndex } = scopePredicate(scope, 1);
  assert.equal(clause, "user_id = $1 AND household_id IS NULL");
  assert.deepEqual(values, ["u-solo"]);
  assert.equal(nextIndex, 2);
}

// ── scopePredicate: household ────────────────────────────────────────────────
{
  const scope = { userId: "u-m", householdId: "h-a" };
  const { clause, values, nextIndex } = scopePredicate(scope, 3);
  assert.equal(clause, "household_id = $3");
  assert.deepEqual(values, ["h-a"]);
  assert.equal(nextIndex, 4);
}

// ── scopePredicate: alias ────────────────────────────────────────────────────
{
  const scope = { userId: "u1", householdId: null };
  const { clause } = scopePredicate(scope, 2, { alias: "l" });
  assert.equal(clause, "l.user_id = $2 AND l.household_id IS NULL");
}

// ── appendScopeWhere ─────────────────────────────────────────────────────────
{
  const where = ["active = TRUE"];
  const values = [];
  const next = appendScopeWhere(
    where,
    values,
    { userId: "u1", householdId: "h1" },
    1,
  );
  assert.deepEqual(where, ["active = TRUE", "household_id = $1"]);
  assert.deepEqual(values, ["h1"]);
  assert.equal(next, 2);
}

// ── resolveScope: solo ───────────────────────────────────────────────────────
{
  const orig = HouseholdRepository.findForUser;
  HouseholdRepository.findForUser = async () => null;
  const scope = await resolveScope("user-solo");
  HouseholdRepository.findForUser = orig;
  assert.deepEqual(scope, { userId: "user-solo", householdId: null });
}

// ── resolveScope: household ──────────────────────────────────────────────────
{
  const orig = HouseholdRepository.findForUser;
  HouseholdRepository.findForUser = async () => ({ id: "house-42" });
  const scope = await resolveScope("user-member");
  HouseholdRepository.findForUser = orig;
  assert.deepEqual(scope, { userId: "user-member", householdId: "house-42" });
}

// ── Isolamento: member A não vê household B (list) ───────────────────────────
{
  const origFind = HouseholdRepository.findForUser;
  const origQuery = ProductRepository.list;
  // Simula list capturando o SQL gerado via mock de resolve + client.query
  HouseholdRepository.findForUser = async (uid) =>
    uid === "member-a" ? { id: "household-a" } : { id: "household-b" };

  const queries = [];
  const fakeClient = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [] };
    },
  };

  await ProductRepository.list("member-a", {}, fakeClient);
  await ProductRepository.list("member-b", {}, fakeClient);

  HouseholdRepository.findForUser = origFind;

  assert.equal(queries.length, 2);
  assert.ok(queries[0].sql.includes("household_id"));
  assert.deepEqual(queries[0].values[0], "household-a");
  assert.ok(!queries[0].values.includes("household-b"));
  assert.deepEqual(queries[1].values[0], "household-b");
  assert.ok(!queries[1].values.includes("household-a"));
}

// ── Solo vs household: predicados distintos em findById ──────────────────────
{
  const origFind = HouseholdRepository.findForUser;
  const seen = [];
  const fakeClient = {
    query: async (sql, values) => {
      seen.push({ sql, values });
      return { rows: [] };
    },
  };

  HouseholdRepository.findForUser = async () => null;
  await ProductRepository.findById("solo-user", "prod-1", fakeClient);

  HouseholdRepository.findForUser = async () => ({ id: "hh-1" });
  await ProductRepository.findById("hh-user", "prod-1", fakeClient);

  HouseholdRepository.findForUser = origFind;

  assert.ok(seen[0].sql.includes("household_id IS NULL"));
  assert.ok(seen[0].values.includes("solo-user"));
  assert.ok(seen[1].sql.includes("household_id"));
  assert.ok(!seen[1].sql.includes("household_id IS NULL"));
  assert.deepEqual(seen[1].values.slice(1), ["hh-1"]);
}

console.log("householdScope.test.mjs: ok");
