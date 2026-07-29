-- F3-3.1 Link compartilhável da lista ativa
-- Token raw só na resposta de criação; só o hash SHA-256 fica no banco.

CREATE TABLE IF NOT EXISTS shopping_list_shares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID NOT NULL REFERENCES shopping_lists (id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_shares_user
  ON shopping_list_shares (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopping_list_shares_token
  ON shopping_list_shares (token_hash);
