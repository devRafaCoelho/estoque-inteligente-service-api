function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Divide nome completo em primeiro nome + sobrenome.
 * @param {string|null|undefined} fullName
 * @returns {{ firstName: string, lastName: string|null }}
 */
function splitPersonName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return { firstName: "Usuário", lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0].slice(0, 150), lastName: null };
  }
  return {
    firstName: parts[0].slice(0, 150),
    lastName: parts.slice(1).join(" ").slice(0, 150),
  };
}

/**
 * @param {{ first_name?: string, last_name?: string, firstName?: string, lastName?: string }} row
 * @returns {string}
 */
function buildDisplayName(row) {
  const first = row.first_name ?? row.firstName ?? "";
  const last = row.last_name ?? row.lastName ?? "";
  return [first, last].filter(Boolean).join(" ").trim();
}

module.exports = {
  digitsOnly,
  splitPersonName,
  buildDisplayName,
};
