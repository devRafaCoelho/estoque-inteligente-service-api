function mapTypeToPreferenceKey(type) {
  switch (type) {
    case "low_stock":
      return "notify_low_stock";
    case "out_of_stock":
      return "notify_out_of_stock";
    case "repurchase_reminder":
      return "notify_repurchase";
    case "consumption_nudge":
    case "missing_consumption":
      return "notify_consumption_nudge";
    default:
      return null;
  }
}

const NotificationPreferenceService = {
  isTypeEnabled(prefs, type) {
    const key = mapTypeToPreferenceKey(type);
    if (!key) return true;
    return prefs?.[key] !== false;
  },
};

module.exports = NotificationPreferenceService;
