const UserPreferencesDto = (row) => ({
  notifyLowStock: row.notify_low_stock !== false,
  notifyOutOfStock: row.notify_out_of_stock !== false,
  notifyRepurchase: row.notify_repurchase !== false,
  notifyConsumptionNudge: row.notify_consumption_nudge !== false,
  notifyEmailDigest: Boolean(row.notify_email_digest),
  consumptionNudgeDays: Number(row.consumption_nudge_days) || 5,
  shoppingListViewMode: row.shopping_list_view_mode || "list",
  currency: row.currency || "BRL",
  locale: row.locale || "pt-BR",
});

module.exports = { UserPreferencesDto };
