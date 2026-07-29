-- F3-4.2 Escopo de dados familiar no estoque/lista
-- household_id nullable: contas existentes permanecem solo (NULL).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_household
  ON products (household_id)
  WHERE household_id IS NOT NULL;

ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_household
  ON shopping_lists (household_id)
  WHERE household_id IS NOT NULL;

-- Uma lista ativa por usuário (solo) ou por household
DROP INDEX IF EXISTS idx_shopping_lists_one_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_one_active_solo
  ON shopping_lists (user_id)
  WHERE status = 'active' AND household_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_one_active_household
  ON shopping_lists (household_id)
  WHERE status = 'active' AND household_id IS NOT NULL;
