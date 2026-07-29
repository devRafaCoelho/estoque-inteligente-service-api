const HouseholdRepository = require("../repositories/HouseholdRepository");
const HouseholdMemberRepository = require("../repositories/HouseholdMemberRepository");

/**
 * Resolve o escopo ativo do usuário (F3-4.2).
 * - Solo: householdId null → dados com user_id = me AND household_id IS NULL
 * - Household: householdId set → dados com household_id = casa
 *
 * @returns {Promise<{ userId: string, householdId: string|null }>}
 */
async function resolveScope(userId, client) {
  if (!userId) {
    return { userId: null, householdId: null };
  }
  const household = await HouseholdRepository.findForUser(userId, client);
  return {
    userId,
    householdId: household?.id || null,
  };
}

/**
 * IDs de usuários no escopo financeiro (compras históricas ficam por user_id).
 * Solo → [me]; household → todos os membros da casa.
 * @returns {Promise<string[]>}
 */
async function resolveHouseholdUserIds(userId, client) {
  const scope = await resolveScope(userId, client);
  if (!scope.householdId) {
    return scope.userId ? [scope.userId] : [];
  }
  const members = await HouseholdMemberRepository.listByHousehold(
    scope.householdId,
    client,
  );
  const ids = members.map((m) => m.user_id).filter(Boolean);
  return ids.length ? ids : [userId];
}

/**
 * Predicado SQL de leitura/escrita para products / shopping_lists.
 * @returns {{ clause: string, values: any[], nextIndex: number }}
 */
function scopePredicate(scope, startIndex = 1, { alias = "" } = {}) {
  const col = (name) => (alias ? `${alias}.${name}` : name);
  let i = startIndex;
  const values = [];

  if (scope.householdId) {
    const clause = `${col("household_id")} = $${i++}`;
    values.push(scope.householdId);
    return { clause, values, nextIndex: i };
  }

  const clause = `${col("user_id")} = $${i++} AND ${col("household_id")} IS NULL`;
  values.push(scope.userId);
  return { clause, values, nextIndex: i };
}

/**
 * Anexa o predicado a um array `where` / `values` mutáveis.
 * @returns {number} próximo índice de parâmetro
 */
function appendScopeWhere(where, values, scope, startIndex, options) {
  const { clause, values: scopeValues, nextIndex } = scopePredicate(
    scope,
    startIndex,
    options,
  );
  where.push(clause);
  values.push(...scopeValues);
  return nextIndex;
}

module.exports = {
  resolveScope,
  resolveHouseholdUserIds,
  scopePredicate,
  appendScopeWhere,
};
