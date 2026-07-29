import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildProductEstimate,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
  trimIntervalOutliers,
  computePersistedConsumptionStats,
  MIN_OUTS_FOR_STABLE,
} = require("../src/utils/consumptionEstimate");

const day = (n) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

// --- média de intervalo e uso semanal ---
{
  const movements = [
    { quantity: 1, at: day(1) },
    { quantity: 1, at: day(8) },
    { quantity: 1, at: day(15) },
  ];
  const interval = averageIntervalDays(movements);
  assert.equal(interval, 7);
  const weekly = averageWeeklyUsageFromMovements(movements, day(15));
  assert.ok(weekly > 0);
  assert.equal(Math.round(weekly * 10) / 10, 1.5);
}

// --- fallback: ciclo persistido no produto (sem movimentos) ---
{
  const product = {
    id: "p1",
    name: "Arroz",
    unit: "kg",
    quantity: 5,
    last_consumed_at: day(1),
    consumption_cycle_days: 7,
    avg_weekly_usage: 1.5,
    repurchase_days: 21,
  };
  const estimate = buildProductEstimate(product, [], day(10));
  assert.equal(estimate.expectedCycleDays, 7);
  assert.equal(estimate.source, "product");
  assert.equal(estimate.daysSinceLastOut, 9);
  assert.equal(estimate.isOverdue, true);
  assert.equal(estimate.overdueDays, 2);
}

// --- histórico de movimentos prevalece sobre repurchase_days ---
{
  const product = {
    id: "p2",
    name: "Leite",
    unit: "l",
    quantity: 2,
    last_consumed_at: day(8),
    consumption_cycle_days: null,
    avg_weekly_usage: null,
    repurchase_days: 7,
  };
  const movements = [
    { quantity: 1, at: day(1) },
    { quantity: 1, at: day(4) },
    { quantity: 1, at: day(8) },
  ];
  const estimate = buildProductEstimate(product, movements, day(12));
  assert.equal(estimate.source, "movements");
  assert.equal(estimate.expectedCycleDays, 4);
  assert.equal(estimate.isOverdue, true);
  assert.equal(estimate.stable, true);
  assert.equal(estimate.confidence, "high");
}

// --- estoque zerado não é overdue ---
{
  const product = {
    id: "p3",
    name: "Água",
    unit: "l",
    quantity: 0,
    last_consumed_at: day(1),
    consumption_cycle_days: 3,
    avg_weekly_usage: 1,
    repurchase_days: null,
  };
  const estimate = buildProductEstimate(product, [], day(10));
  assert.equal(estimate.isOverdue, false);
}

// --- sem histórico: fallback repurchase_days (não inventa ciclo) ---
{
  const product = {
    id: "p4",
    name: "Café",
    unit: "un",
    quantity: 3,
    last_consumed_at: day(1),
    consumption_cycle_days: null,
    avg_weekly_usage: null,
    repurchase_days: 14,
  };
  const estimate = buildProductEstimate(product, [], day(20));
  assert.equal(estimate.source, "repurchase_days");
  assert.equal(estimate.expectedCycleDays, 14);
  assert.equal(estimate.confidence, "low");
  assert.equal(estimate.stable, false);
  assert.equal(estimate.isOverdue, true);
}

// --- sem histórico e sem repurchase: não inventa ---
{
  const product = {
    id: "p5",
    name: "Novo",
    unit: "un",
    quantity: 2,
    last_consumed_at: null,
    consumption_cycle_days: null,
    avg_weekly_usage: null,
    repurchase_days: null,
  };
  const estimate = buildProductEstimate(product, [], day(10));
  assert.equal(estimate.expectedCycleDays, null);
  assert.equal(estimate.source, null);
  assert.equal(estimate.isOverdue, false);
  assert.equal(computePersistedConsumptionStats([]), null);
  assert.equal(
    computePersistedConsumptionStats([
      { quantity: 1, at: day(1) },
      { quantity: 1, at: day(8) },
    ]),
    null,
  );
}

// --- outliers: intervalo absurdo não distorce a média ---
{
  const withOutlier = [
    { quantity: 1, at: day(1) },
    { quantity: 1, at: day(8) },
    { quantity: 1, at: day(15) },
    { quantity: 1, at: day(120) }, // gap enorme
  ];
  const trimmed = trimIntervalOutliers([7, 7, 105]);
  assert.deepEqual(trimmed, [7, 7]);
  const interval = averageIntervalDays(withOutlier);
  assert.ok(interval != null && interval < 20);
  assert.equal(Math.round(interval), 7);
}

// --- persistência só com histórico estável ---
{
  const movements = [
    { quantity: 1, at: day(1) },
    { quantity: 1, at: day(8) },
    { quantity: 1, at: day(15) },
  ];
  assert.ok(movements.length >= MIN_OUTS_FOR_STABLE);
  const stats = computePersistedConsumptionStats(movements, day(15));
  assert.ok(stats);
  assert.equal(stats.consumptionCycleDays, 7);
  assert.ok(stats.avgWeeklyUsage > 0);
}

console.log("consumptionEstimate.test.mjs: ok");
