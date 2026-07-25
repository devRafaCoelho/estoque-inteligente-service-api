import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildProductEstimate,
  averageIntervalDays,
  averageWeeklyUsageFromMovements,
} = require("../src/utils/consumptionEstimate");

const day = (n) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

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
}

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
}

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
}

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

console.log("consumptionEstimate.test.mjs: ok");
