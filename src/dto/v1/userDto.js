const UserDto = (row, authProviders = []) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  avatarUrl: row.avatar_url || null,
  defaultState: row.default_state || null,
  status: row.status,
  authProviders,
  lastLoginAt: row.last_login_at || null,
  createdAt: row.created_at,
});

module.exports = { UserDto };
