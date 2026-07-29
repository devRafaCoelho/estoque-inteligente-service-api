import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  evaluateConsumptionNudgeGate,
  isWithinNudgeWindow,
  resolveNudgeWindowDays,
  isConsumptionNudgeEnabled,
} = require("../src/utils/consumptionNudgePolicy");

const dayMs = 24 * 60 * 60 * 1000;
const now = new Date("2026-07-29T12:00:00.000Z");

// preferência false → não cria
{
  const gate = evaluateConsumptionNudgeGate({
    prefs: { notify_consumption_nudge: false, consumption_nudge_days: 5 },
    recentReminderAt: null,
    now,
  });
  assert.equal(gate.allow, false);
  assert.equal(gate.reason, "preference_disabled");
  assert.equal(isConsumptionNudgeEnabled({ notify_consumption_nudge: false }), false);
}

// segunda avaliação na mesma janela → não recria
{
  const recent = new Date(now.getTime() - 2 * dayMs);
  const gate = evaluateConsumptionNudgeGate({
    prefs: { notify_consumption_nudge: true, consumption_nudge_days: 5 },
    recentReminderAt: recent,
    now,
  });
  assert.equal(gate.allow, false);
  assert.equal(gate.reason, "within_window");
  assert.equal(isWithinNudgeWindow(recent, 5, now), true);
}

// após a janela → pode criar de novo
{
  const recent = new Date(now.getTime() - 5 * dayMs);
  assert.equal(isWithinNudgeWindow(recent, 5, now), false);
  const gate = evaluateConsumptionNudgeGate({
    prefs: { notify_consumption_nudge: true, consumption_nudge_days: 5 },
    recentReminderAt: recent,
    now,
  });
  assert.equal(gate.allow, true);
  assert.equal(gate.reason, "ok");
  assert.equal(gate.windowDays, 5);
}

// sem lembrete recente e preferência on → permite
{
  const gate = evaluateConsumptionNudgeGate({
    prefs: { notify_consumption_nudge: true, consumption_nudge_days: 3 },
    recentReminderAt: null,
    now,
  });
  assert.equal(gate.allow, true);
  assert.equal(gate.windowDays, 3);
}

// clamp do intervalo
{
  assert.equal(resolveNudgeWindowDays({ consumption_nudge_days: 0 }), 1);
  assert.equal(resolveNudgeWindowDays({ consumption_nudge_days: 99 }), 30);
  assert.equal(resolveNudgeWindowDays({}), 5);
}

console.log("consumptionNudgePolicy.test.mjs: ok");
