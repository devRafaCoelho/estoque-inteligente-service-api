import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildFinanceTips, estimateWeeklyCost } = require("../src/utils/financeTips");

// fixtures: produtos + gastos
{
  const tips = buildFinanceTips({
    byCategory: [
      { category: "grocery", total: 200 },
      { category: "dairy", total: 50 },
    ],
    monthTotal: 250,
    summary: {
      month: {
        total: 250,
        previousTotal: 180,
        deltaPercent: 38.9,
        projectedTotal: 300,
      },
    },
    products: [
      {
        id: "p1",
        name: "Leite",
        unit: "l",
        quantity: 0,
        min_quantity: 2,
        avg_weekly_usage: 4,
        avg_unit_price: 5,
        active: true,
      },
      {
        id: "p2",
        name: "Arroz",
        unit: "kg",
        quantity: 8,
        min_quantity: 2,
        avg_weekly_usage: 1.5,
        avg_unit_price: 6,
        active: true,
      },
    ],
    categoryLabels: new Map([["grocery", "Mercearia"]]),
    isCurrentMonth: true,
  });

  assert.ok(tips.some((t) => t.id === "category_share"));
  assert.ok(tips.some((t) => t.id === "month_up"));
  const consumption = tips.find((t) => t.id === "consumption_low_out_cost");
  assert.ok(consumption);
  assert.equal(consumption.source, "consumption");
  assert.match(consumption.message, /Leite/);
  assert.match(consumption.message, /R\$/);
  assert.ok(!consumption.message.includes("undefined"));
}

// sem dados → dica genérica segura
{
  const tips = buildFinanceTips({
    byCategory: [],
    monthTotal: 0,
    summary: null,
    products: [],
    isCurrentMonth: true,
  });
  assert.ok(tips.length >= 1);
  assert.ok(
    tips.some((t) => t.id === "no_purchases") || tips.some((t) => t.id === "generic_safe"),
  );
  assert.ok(tips.every((t) => typeof t.message === "string" && t.message.length > 10));
}

// estimateWeeklyCost não inventa sem preço/uso
{
  assert.equal(
    estimateWeeklyCost({ avg_weekly_usage: 2, avg_unit_price: null }),
    null,
  );
  assert.equal(
    estimateWeeklyCost({ avg_weekly_usage: null, avg_unit_price: 5 }),
    null,
  );
  const ok = estimateWeeklyCost({ avg_weekly_usage: 2, avg_unit_price: 4.5 });
  assert.equal(ok.weeklyCost, 9);
}

console.log("financeTips.test.mjs: ok");
