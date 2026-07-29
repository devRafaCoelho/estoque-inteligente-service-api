import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  isRepurchaseDue,
  resolveShoppingListOrigin,
} = require("../src/utils/stockRules");

const dayMs = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 6, 29, 12, 0, 0);

{
  const origin = resolveShoppingListOrigin(
    { quantity: 0, min_quantity: 2, repurchase_days: 30, last_purchased_at: new Date(now) },
    now,
  );
  assert.deepEqual(origin, { origin: "out_of_stock", priority: "high" });
}

{
  const origin = resolveShoppingListOrigin(
    { quantity: 1, min_quantity: 2, repurchase_days: 30, last_purchased_at: new Date(now) },
    now,
  );
  assert.deepEqual(origin, { origin: "low_stock", priority: "high" });
}

{
  // Ciclo vencido, mas estoque saudável → não entra na lista automática
  const origin = resolveShoppingListOrigin(
    {
      quantity: 8,
      min_quantity: 2,
      repurchase_days: 7,
      last_purchased_at: new Date(now - 20 * dayMs),
    },
    now,
  );
  assert.equal(origin, null);
  assert.equal(
    isRepurchaseDue(
      {
        repurchase_days: 7,
        last_purchased_at: new Date(now - 20 * dayMs),
      },
      now,
    ),
    true,
  );
}

{
  const origin = resolveShoppingListOrigin(
    {
      quantity: 5,
      min_quantity: 2,
      repurchase_days: null,
      last_purchased_at: null,
    },
    now,
  );
  assert.equal(origin, null);
}

console.log("stockRules.test.mjs: ok");
