function parseMinutes(hhmm, fallback) {
  const value = String(hhmm || fallback || "").trim();
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getLocalMinutes(timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZone || "America/Sao_Paulo",
  }).formatToParts(new Date());
  const hour = Number(parts.find((item) => item.type === "hour")?.value || 0);
  const minute = Number(parts.find((item) => item.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

const DeliveryWindowService = {
  isQuietHoursActive(prefs) {
    if (prefs?.quiet_hours_enabled === false) return false;

    const start = parseMinutes(prefs?.quiet_hours_start, 22 * 60);
    const end = parseMinutes(prefs?.quiet_hours_end, 8 * 60);
    const now = getLocalMinutes(prefs?.quiet_hours_timezone);

    if (start === end) return true;
    if (start < end) return now >= start && now < end;
    return now >= start || now < end;
  },
};

module.exports = DeliveryWindowService;
