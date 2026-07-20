-- =============================================================
-- Estoque Inteligente — Script de criação do banco (v1)
-- PostgreSQL 16+
--
-- IMPORTANTE: execute este script CONECTADO no banco
-- "estoque_inteligente" (NÃO no banco "postgres").
--
-- Ordem: extensões -> ENUMs -> tabelas (por dependência) -> índices.
-- =============================================================

-- -------------------------------------------------------------
-- 0. Extensões
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- similaridade de nomes (match IA/NF)

-- -------------------------------------------------------------
-- 1. Tipos enumerados (ENUMs)
-- -------------------------------------------------------------
CREATE TYPE product_category AS ENUM (
  'cleaning',
  'hygiene',
  'produce',
  'grocery',
  'dairy',
  'beverages',
  'frozen',
  'household',
  'other'
);

CREATE TYPE stock_unit AS ENUM (
  'un',
  'g',
  'kg',
  'ml',
  'l',
  'pack',
  'can',
  'bottle',
  'box',
  'other'
);

CREATE TYPE intake_source AS ENUM (
  'natural_language',
  'nf_qr',
  'receipt_photo',
  'manual',
  'chat'
);

-- Fontes da baixa (consumo); subset do intake
CREATE TYPE stock_out_source AS ENUM (
  'natural_language',
  'chat',
  'manual',
  'nudge'
);

CREATE TYPE intake_status AS ENUM (
  'draft',
  'confirmed',
  'cancelled'
);

CREATE TYPE movement_type AS ENUM (
  'in',
  'out',
  'adjust'
);

CREATE TYPE shopping_list_status AS ENUM (
  'active',
  'completed',
  'archived'
);

CREATE TYPE shopping_item_priority AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE shopping_item_origin AS ENUM (
  'low_stock',
  'out_of_stock',
  'repurchase_time',
  'ai',
  'manual'
);

CREATE TYPE notification_type AS ENUM (
  'low_stock',
  'out_of_stock',
  'repurchase_reminder',
  'consumption_nudge',      -- lembrete genérico: "esqueceu de dar baixa?"
  'missing_consumption',    -- padrão de uso sem baixa no período
  'intake_ready',
  'system'
);

CREATE TYPE chat_role AS ENUM (
  'user',
  'assistant',
  'system'
);

CREATE TYPE account_status AS ENUM (
  'active',
  'pending_deletion',
  'deleted'
);

CREATE TYPE auth_provider AS ENUM (
  'local',
  'google',
  'apple'
);

-- -------------------------------------------------------------
-- 2. Conta e autenticação
-- -------------------------------------------------------------

-- 2.1 users
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),              -- NULL para contas só Google/Apple
  avatar_url    TEXT,
  status        account_status NOT NULL DEFAULT 'active',
  default_state CHAR(2),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_email_active ON users (email)
  WHERE status = 'active';

-- 2.2 user_auth_identities
CREATE TABLE user_auth_identities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider         auth_provider NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,   -- `sub` do Google/Apple
  email            VARCHAR(255),            -- snapshot do e-mail no provedor
  email_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_user_auth_identities_user ON user_auth_identities (user_id);
CREATE INDEX idx_user_auth_identities_email ON user_auth_identities (email)
  WHERE email IS NOT NULL;

-- 2.3 password_reset_tokens
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,     -- hash do token; nunca o token puro
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id);
CREATE UNIQUE INDEX idx_password_reset_tokens_hash ON password_reset_tokens (token_hash);

-- 2.4 user_preferences
CREATE TABLE user_preferences (
  user_id                     UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  notify_low_stock            BOOLEAN NOT NULL DEFAULT TRUE,
  notify_out_of_stock         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_repurchase           BOOLEAN NOT NULL DEFAULT TRUE,
  notify_consumption_nudge    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_email_digest         BOOLEAN NOT NULL DEFAULT FALSE,
  consumption_nudge_days      INTEGER NOT NULL DEFAULT 5
    CHECK (consumption_nudge_days BETWEEN 1 AND 30),
  push_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
  shopping_list_view_mode     VARCHAR(20) NOT NULL DEFAULT 'list',
    -- list | paper | table (table só faz sentido no client desktop)
  currency                    CHAR(3) NOT NULL DEFAULT 'BRL',
  locale                      VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  preferred_view_mode         VARCHAR(20) NOT NULL DEFAULT 'cards',
    -- cards | table (table = desktop opcional)
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 3. Estoque
-- -------------------------------------------------------------

-- 3.1 products
CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name              VARCHAR(200) NOT NULL,
  category          product_category NOT NULL DEFAULT 'other',
  quantity          NUMERIC(12, 3) NOT NULL DEFAULT 0
    CHECK (quantity >= 0),
  unit              stock_unit NOT NULL DEFAULT 'un',
  min_quantity      NUMERIC(12, 3) NOT NULL DEFAULT 1
    CHECK (min_quantity >= 0),
  avg_unit_price    NUMERIC(12, 2),
  last_purchased_at TIMESTAMPTZ,
  last_consumed_at  TIMESTAMPTZ,     -- última baixa (movimento out)
  avg_weekly_usage  NUMERIC(12, 3),  -- estimado a partir do histórico de outs
  consumption_cycle_days INTEGER,    -- intervalo médio entre baixas (estimado)
  repurchase_days   INTEGER,
  notes             TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_user ON products (user_id);
CREATE INDEX idx_products_user_category ON products (user_id, category);
CREATE INDEX idx_products_user_qty ON products (user_id, quantity);
CREATE INDEX idx_products_low_stock ON products (user_id)
  WHERE active = TRUE AND quantity > 0 AND quantity <= min_quantity;
CREATE INDEX idx_products_out ON products (user_id)
  WHERE active = TRUE AND quantity = 0;
CREATE INDEX idx_products_last_consumed ON products (user_id, last_consumed_at)
  WHERE active = TRUE;
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- 3.2 product_aliases
CREATE TABLE product_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  alias       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, alias)
);

CREATE INDEX idx_product_aliases_product ON product_aliases (product_id);

-- -------------------------------------------------------------
-- 4. Entrada (compra) e baixa (consumo)
-- -------------------------------------------------------------

-- 4.1 stock_intakes
CREATE TABLE stock_intakes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source          intake_source NOT NULL,
  status          intake_status NOT NULL DEFAULT 'draft',
  raw_input       TEXT,
  raw_payload     JSONB NOT NULL DEFAULT '{}',
  access_key      VARCHAR(44),
  state_code      CHAR(2),
  media_url       TEXT,
  error_message   TEXT,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_intakes_user ON stock_intakes (user_id, created_at DESC);
CREATE INDEX idx_stock_intakes_status ON stock_intakes (status);
CREATE INDEX idx_stock_intakes_access_key ON stock_intakes (access_key)
  WHERE access_key IS NOT NULL;

-- 4.2 stock_intake_items
CREATE TABLE stock_intake_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id         UUID NOT NULL REFERENCES stock_intakes (id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products (id) ON DELETE SET NULL,
  name              VARCHAR(200) NOT NULL,
  quantity          NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit              stock_unit NOT NULL DEFAULT 'un',
  category          product_category,
  unit_price        NUMERIC(12, 2),
  confidence        NUMERIC(4, 3),
  matched_existing  BOOLEAN NOT NULL DEFAULT FALSE,
  excluded          BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_intake_items_intake ON stock_intake_items (intake_id);

-- 4.3 stock_outs
CREATE TABLE stock_outs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source          stock_out_source NOT NULL,
  status          intake_status NOT NULL DEFAULT 'draft',
  raw_input       TEXT,
  raw_payload     JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_outs_user ON stock_outs (user_id, created_at DESC);
CREATE INDEX idx_stock_outs_status ON stock_outs (status);

-- 4.4 stock_out_items
CREATE TABLE stock_out_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_out_id      UUID NOT NULL REFERENCES stock_outs (id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products (id) ON DELETE SET NULL,
  name              VARCHAR(200) NOT NULL,
  quantity          NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit              stock_unit NOT NULL DEFAULT 'un',
  confidence        NUMERIC(4, 3),
  matched_existing  BOOLEAN NOT NULL DEFAULT FALSE,
  available_qty     NUMERIC(12, 3),
  warning           VARCHAR(100),
  excluded          BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_out_items_out ON stock_out_items (stock_out_id);

-- 4.5 stock_movements
CREATE TABLE stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  intake_id       UUID REFERENCES stock_intakes (id) ON DELETE SET NULL,
  stock_out_id    UUID REFERENCES stock_outs (id) ON DELETE SET NULL,
  type            movement_type NOT NULL,
  quantity        NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit            stock_unit NOT NULL,
  quantity_before NUMERIC(12, 3) NOT NULL,
  quantity_after  NUMERIC(12, 3) NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements (product_id, created_at DESC);
CREATE INDEX idx_stock_movements_user ON stock_movements (user_id, created_at DESC);
CREATE INDEX idx_stock_movements_intake ON stock_movements (intake_id)
  WHERE intake_id IS NOT NULL;
CREATE INDEX idx_stock_movements_out ON stock_movements (stock_out_id)
  WHERE stock_out_id IS NOT NULL;

-- -------------------------------------------------------------
-- 5. Financeiro
-- -------------------------------------------------------------

-- 5.1 purchases
CREATE TABLE purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  intake_id       UUID UNIQUE REFERENCES stock_intakes (id) ON DELETE SET NULL,
  store_name      VARCHAR(200),
  purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency        CHAR(3) NOT NULL DEFAULT 'BRL',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_user_date ON purchases (user_id, purchased_at DESC);

-- 5.2 purchase_items
CREATE TABLE purchase_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id   UUID NOT NULL REFERENCES purchases (id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products (id) ON DELETE SET NULL,
  name          VARCHAR(200) NOT NULL,
  quantity      NUMERIC(12, 3) NOT NULL,
  unit          stock_unit NOT NULL,
  unit_price    NUMERIC(12, 2),
  line_total    NUMERIC(12, 2),
  category      product_category,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items (purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items (product_id);

-- -------------------------------------------------------------
-- 6. Lista de compras
-- -------------------------------------------------------------

-- 6.1 shopping_lists
CREATE TABLE shopping_lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL DEFAULT 'Lista de compras',
  status       shopping_list_status NOT NULL DEFAULT 'active',
  generated_by VARCHAR(40),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_shopping_lists_user ON shopping_lists (user_id, status);
CREATE UNIQUE INDEX idx_shopping_lists_one_active
  ON shopping_lists (user_id)
  WHERE status = 'active';

-- 6.2 shopping_list_items
CREATE TABLE shopping_list_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists (id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products (id) ON DELETE SET NULL,
  name             VARCHAR(200) NOT NULL,
  suggested_qty    NUMERIC(12, 3),
  unit             stock_unit DEFAULT 'un',
  priority         shopping_item_priority NOT NULL DEFAULT 'medium',
  origin           shopping_item_origin NOT NULL DEFAULT 'manual',
  checked          BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopping_list_items_list ON shopping_list_items (shopping_list_id);

-- -------------------------------------------------------------
-- 7. Notificações
-- -------------------------------------------------------------
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  product_id  UUID REFERENCES products (id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id)
  WHERE read_at IS NULL;

-- -------------------------------------------------------------
-- 8. Chat (assistente IA)
-- -------------------------------------------------------------
CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id, updated_at DESC);

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  role        chat_role NOT NULL,
  content     TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, created_at);

-- -------------------------------------------------------------
-- 9. Operacional — logs de coleta de NF por UF
-- -------------------------------------------------------------
CREATE TABLE nf_collector_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  intake_id     UUID REFERENCES stock_intakes (id) ON DELETE SET NULL,
  state_code    CHAR(2),
  access_key    VARCHAR(44),
  source_url    TEXT,
  success       BOOLEAN NOT NULL,
  error_message TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nf_collector_logs_state ON nf_collector_logs (state_code, created_at DESC);

-- =============================================================
-- Fim do script v1
-- =============================================================
