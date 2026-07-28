const UserPreferencesDto = (row) => ({
  notifyLowStock: row.notify_low_stock !== false,
  notifyOutOfStock: row.notify_out_of_stock !== false,
  notifyRepurchase: row.notify_repurchase !== false,
  notifyConsumptionNudge: row.notify_consumption_nudge !== false,
  notifyEmailDigest: Boolean(row.notify_email_digest),
  consumptionNudgeDays: Number(row.consumption_nudge_days) || 5,
  pushEnabled: Boolean(row.push_enabled),
  quietHoursEnabled: row.quiet_hours_enabled !== false,
  quietHoursStart: row.quiet_hours_start ? String(row.quiet_hours_start).slice(0, 5) : "22:00",
  quietHoursEnd: row.quiet_hours_end ? String(row.quiet_hours_end).slice(0, 5) : "08:00",
  quietHoursTimezone: row.quiet_hours_timezone || "America/Sao_Paulo",
  lastEmailDigestAt: row.last_email_digest_at || null,
  shoppingListViewMode: row.shopping_list_view_mode || "paper",
  currency: row.currency || "BRL",
  locale: row.locale || "pt-BR",
});

module.exports = { UserPreferencesDto };
