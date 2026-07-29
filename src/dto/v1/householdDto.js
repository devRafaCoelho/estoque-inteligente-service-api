const HouseholdDto = (row) => ({
  id: row.id,
  name: row.name,
  ownerUserId: row.owner_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const HouseholdMemberDto = (row) => ({
  id: row.id,
  householdId: row.household_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
  email: row.email || null,
  firstName: row.first_name || null,
  lastName: row.last_name || null,
  avatarUrl: row.avatar_url || null,
});

const HouseholdInviteDto = (row) => ({
  id: row.id,
  householdId: row.household_id,
  email: row.email,
  role: row.role,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

module.exports = {
  HouseholdDto,
  HouseholdMemberDto,
  HouseholdInviteDto,
};
