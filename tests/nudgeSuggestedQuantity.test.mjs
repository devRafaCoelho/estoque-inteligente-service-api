import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  suggestedUsualQuantity,
  buildQuickConsumeNudgePayload,
  buildProductEstimate,
} = require("../src/utils/consumptionEstimate");

const day = (n) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));

// suggestedQuantity a partir de média semanal + ciclo
{
  const qty = suggestedUsualQuantity({
    avgWeeklyUsage: 1,
    expectedCycleDays: 7,
    quantity: 5,
    unit: "kg",
  });
  assert.equal(qty, 1);
}

// limita ao estoque
{
  const qty = suggestedUsualQuantity({
    avgWeeklyUsage: 4,
    expectedCycleDays: 7,
    quantity: 2,
  });
  assert.equal(qty, 2);
}

// sem estimativa → null (não inventa)
{
  assert.equal(
    suggestedUsualQuantity({
      avgWeeklyUsage: null,
      expectedCycleDays: 7,
      quantity: 3,
    }),
    null,
  );
}

// payload de nudge inclui suggestedQuantity quando há estimativa
{
  const product = {
    id: "p1",
    name: "Arroz",
    unit: "kg",
    quantity: 5,
    last_consumed_at: day(1),
    consumption_cycle_days: null,
    avg_weekly_usage: null,
    repurchase_days: null,
  };
  const movements = [
    { quantity: 1, at: day(1) },
    { quantity: 1, at: day(8) },
    { quantity: 1, at: day(15) },
  ];
  const estimate = buildProductEstimate(product, movements, day(22));
  assert.ok(estimate.avgWeeklyUsage > 0);
  assert.equal(estimate.expectedCycleDays, 7);

  const payload = buildQuickConsumeNudgePayload({
    candidates: [estimate],
    nudgeDays: 5,
  });

  assert.equal(payload.action, "open_quick_consume");
  assert.equal(payload.unit, "kg");
  assert.ok(
    payload.suggestedQuantity != null && payload.suggestedQuantity > 0,
    "payload deve ter suggestedQuantity",
  );
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].suggestedQuantity, payload.suggestedQuantity);
  assert.equal(payload.items[0].unit, "kg");
}

// vários itens: suggestedQuantity por item, sem top-level único
{
  const payload = buildQuickConsumeNudgePayload({
    candidates: [
      {
        productId: "a",
        name: "Leite",
        unit: "l",
        quantity: 4,
        avgWeeklyUsage: 2,
        expectedCycleDays: 7,
        daysSinceLastOut: 10,
      },
      {
        productId: "b",
        name: "Pão",
        unit: "un",
        quantity: 6,
        avgWeeklyUsage: 7,
        expectedCycleDays: 3,
        daysSinceLastOut: 5,
      },
    ],
    nudgeDays: 5,
  });
  assert.equal(payload.suggestedQuantity, undefined);
  assert.ok(payload.items[0].suggestedQuantity != null);
  assert.ok(payload.items[1].suggestedQuantity != null);
}

console.log("nudgeSuggestedQuantity.test.mjs: ok");
