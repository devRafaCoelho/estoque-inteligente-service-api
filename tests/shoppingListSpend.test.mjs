import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { estimateShoppingListSpend } = require("../src/utils/shoppingListSpend");

{
  const products = new Map([
    ["p1", { id: "p1", avg_unit_price: 6.5, unit: "kg" }],
    ["p2", { id: "p2", avg_unit_price: 5, unit: "l" }],
  ]);
  const estimate = estimateShoppingListSpend(
    [
      { id: "i1", product_id: "p1", name: "Arroz", suggested_qty: 2, unit: "kg", checked: false },
      { id: "i2", product_id: "p2", name: "Leite", suggested_qty: 4, unit: "l", checked: false },
      { id: "i3", product_id: "p1", name: "Arroz marcado", suggested_qty: 1, checked: true },
    ],
    products,
  );
  assert.equal(estimate.hasEstimate, true);
  assert.equal(estimate.estimatedTotal, 33); // 2*6.5 + 4*5
  assert.equal(estimate.pricedItemCount, 2);
  assert.equal(estimate.unpricedItemCount, 0);
  assert.equal(estimate.isPartial, false);
}

{
  const estimate = estimateShoppingListSpend(
    [
      { product_id: "p1", suggested_qty: 1, checked: false },
      { product_id: null, name: "Item manual", suggested_qty: 2, checked: false },
    ],
    new Map([["p1", { avg_unit_price: 10 }]]),
  );
  assert.equal(estimate.estimatedTotal, 10);
  assert.equal(estimate.isPartial, true);
  assert.equal(estimate.unpricedItemCount, 1);
  assert.equal(estimate.unpricedItems.length, 1);
  assert.equal(estimate.unpricedItems[0].name, "Item manual");
  assert.equal(estimate.unpricedItems[0].canSetPrice, false);
}

{
  const estimate = estimateShoppingListSpend(
    [{ name: "Sem preço", suggested_qty: 1, checked: false }],
    new Map(),
  );
  assert.equal(estimate.hasEstimate, false);
  assert.equal(estimate.estimatedTotal, 0);
}

{
  const estimate = estimateShoppingListSpend(
    [
      { product_id: "p1", name: "Café", suggested_qty: 1, unit: "pct", checked: false },
      { product_id: "p2", name: "Arroz", suggested_qty: 2, unit: "kg", checked: false },
    ],
    new Map([
      ["p1", { avg_unit_price: null, unit: "pct" }],
      ["p2", { avg_unit_price: 8, unit: "kg" }],
    ]),
  );
  assert.equal(estimate.estimatedTotal, 16);
  assert.equal(estimate.isPartial, true);
  assert.equal(estimate.unpricedItems.length, 1);
  assert.equal(estimate.unpricedItems[0].productId, "p1");
  assert.equal(estimate.unpricedItems[0].canSetPrice, true);
}

console.log("shoppingListSpend.test.mjs: ok");
