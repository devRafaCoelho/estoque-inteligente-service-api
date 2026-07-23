const { buildDisplayName } = require("../../helpers/personName");

const UserDto = (row, authProviders = []) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name || null,
  name: buildDisplayName(row),
  email: row.email,
  avatarUrl: row.avatar_url || null,
  phone: row.phone || null,
  cpf: row.cpf || null,
  zipCode: row.zip_code || null,
  street: row.street || null,
  streetNumber: row.street_number || null,
  complement: row.complement || null,
  neighborhood: row.neighborhood || null,
  city: row.city || null,
  defaultState: row.default_state || null,
  status: row.status,
  authProviders,
  lastLoginAt: row.last_login_at || null,
  createdAt: row.created_at,
});

module.exports = { UserDto };
