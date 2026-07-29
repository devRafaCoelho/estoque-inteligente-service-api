-- F3-4.1 Modelo households + members
-- Conta familiar: dono (owner) e membros (member) com convite por e-mail.

CREATE TABLE IF NOT EXISTS households (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,
  owner_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_households_owner
  ON households (owner_user_id);

CREATE TABLE IF NOT EXISTS household_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user
  ON household_members (user_id);

CREATE INDEX IF NOT EXISTS idx_household_members_household
  ON household_members (household_id, joined_at ASC);

CREATE TABLE IF NOT EXISTS household_invites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES households (id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  invited_by_user_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash          VARCHAR(64) NOT NULL UNIQUE,
  role                VARCHAR(20) NOT NULL DEFAULT 'member'
                        CHECK (role IN ('member')),
  expires_at          TIMESTAMPTZ NOT NULL,
  accepted_at         TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_invites_household
  ON household_invites (household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_household_invites_email
  ON household_invites (email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
