/** Preferência e anti-fadiga do nudge de baixa usual (F3-1.4). */

const DEFAULT_NUDGE_DAYS = 5;
const MIN_NUDGE_DAYS = 1;
const MAX_NUDGE_DAYS = 30;

const CONSUMPTION_NUDGE_TYPES = ["consumption_nudge", "missing_consumption"];

function isConsumptionNudgeEnabled(prefs) {
  return prefs?.notify_consumption_nudge !== false;
}

/**
 * Janela anti-spam em dias (clamp 1–30), alinhada à preferência do usuário.
 */
function resolveNudgeWindowDays(prefs) {
  const raw = Number(prefs?.consumption_nudge_days);
  if (!Number.isFinite(raw)) return DEFAULT_NUDGE_DAYS;
  return Math.min(MAX_NUDGE_DAYS, Math.max(MIN_NUDGE_DAYS, Math.round(raw)));
}

/**
 * Último lembrete ainda está dentro da janela configurada?
 * @param {Date|string|null|undefined} lastCreatedAt
 * @param {number} windowDays
 * @param {Date} [now]
 */
function isWithinNudgeWindow(lastCreatedAt, windowDays, now = new Date()) {
  if (!lastCreatedAt) return false;
  const days = Number(windowDays);
  if (!Number.isFinite(days) || days < 1) return false;
  const then = new Date(lastCreatedAt).getTime();
  if (!Number.isFinite(then)) return false;
  const elapsedMs = now.getTime() - then;
  if (elapsedMs < 0) return true;
  return elapsedMs < days * 24 * 60 * 60 * 1000;
}

/**
 * Pode criar um novo nudge de consumo?
 * — preferência off → nunca
 * — já houve consumption_nudge ou missing_consumption na janela → não
 *
 * @param {{
 *   prefs: object,
 *   recentReminderAt?: Date|string|null,
 *   now?: Date,
 * }} args
 * @returns {{ allow: boolean, reason: string, windowDays: number }}
 */
function evaluateConsumptionNudgeGate({
  prefs,
  recentReminderAt = null,
  now = new Date(),
} = {}) {
  const windowDays = resolveNudgeWindowDays(prefs);

  if (!isConsumptionNudgeEnabled(prefs)) {
    return { allow: false, reason: "preference_disabled", windowDays };
  }

  if (isWithinNudgeWindow(recentReminderAt, windowDays, now)) {
    return { allow: false, reason: "within_window", windowDays };
  }

  return { allow: true, reason: "ok", windowDays };
}

module.exports = {
  DEFAULT_NUDGE_DAYS,
  MIN_NUDGE_DAYS,
  MAX_NUDGE_DAYS,
  CONSUMPTION_NUDGE_TYPES,
  isConsumptionNudgeEnabled,
  resolveNudgeWindowDays,
  isWithinNudgeWindow,
  evaluateConsumptionNudgeGate,
};
