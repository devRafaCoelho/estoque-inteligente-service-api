-- Migração para bancos já existentes (soft-delete de produtos).
-- Idempotente: só adiciona a coluna se ainda não existir.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_products_low_stock;
CREATE INDEX idx_products_low_stock ON products (user_id)
  WHERE active = TRUE AND deleted_at IS NULL AND quantity > 0 AND quantity <= min_quantity;

DROP INDEX IF EXISTS idx_products_out;
CREATE INDEX idx_products_out ON products (user_id)
  WHERE active = TRUE AND deleted_at IS NULL AND quantity = 0;

DROP INDEX IF EXISTS idx_products_last_consumed;
CREATE INDEX idx_products_last_consumed ON products (user_id, last_consumed_at)
  WHERE active = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_alive ON products (user_id)
  WHERE deleted_at IS NULL;
