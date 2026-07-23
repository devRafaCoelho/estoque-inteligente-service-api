-- -------------------------------------------------------------
-- Dados de referência (categorias, unidades, UFs)
-- Execute após database.sql:
--   psql -d estoque_inteligente -f database_ref_data.sql
--
-- Se você já criou as tabelas com prefixo ref_*, rode antes:
--   ALTER TABLE IF EXISTS ref_product_categories RENAME TO product_categories;
--   ALTER TABLE IF EXISTS ref_stock_units RENAME TO stock_units;
--   ALTER TABLE IF EXISTS ref_brazilian_states RENAME TO brazilian_states;
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_categories (
  code        VARCHAR(32) PRIMARY KEY,
  label       VARCHAR(80) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS stock_units (
  code        VARCHAR(32) PRIMARY KEY,
  label       VARCHAR(80) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS brazilian_states (
  code        CHAR(2) PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Categorias (codes alinhados ao enum product_category)
INSERT INTO product_categories (code, label, sort_order) VALUES
  ('cleaning',  'Limpeza',     10),
  ('hygiene',   'Higiene',     20),
  ('produce',   'Hortifruti',  30),
  ('grocery',   'Mercearia',   40),
  ('dairy',     'Laticínios',  50),
  ('beverages', 'Bebidas',     60),
  ('frozen',    'Congelados',  70),
  ('household', 'Casa',        80),
  ('other',     'Outros',      90)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    active = TRUE;

-- Unidades (codes alinhados ao enum stock_unit)
INSERT INTO stock_units (code, label, sort_order) VALUES
  ('un',     'un',      10),
  ('g',      'g',       20),
  ('kg',     'kg',      30),
  ('ml',     'ml',      40),
  ('l',      'L',       50),
  ('pack',   'pct',     60),
  ('can',    'lata',    70),
  ('bottle', 'garrafa', 80),
  ('box',    'cx',      90),
  ('other',  'outro',  100)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    active = TRUE;

-- UFs
INSERT INTO brazilian_states (code, name, sort_order) VALUES
  ('AC', 'Acre', 1),
  ('AL', 'Alagoas', 2),
  ('AP', 'Amapá', 3),
  ('AM', 'Amazonas', 4),
  ('BA', 'Bahia', 5),
  ('CE', 'Ceará', 6),
  ('DF', 'Distrito Federal', 7),
  ('ES', 'Espírito Santo', 8),
  ('GO', 'Goiás', 9),
  ('MA', 'Maranhão', 10),
  ('MT', 'Mato Grosso', 11),
  ('MS', 'Mato Grosso do Sul', 12),
  ('MG', 'Minas Gerais', 13),
  ('PA', 'Pará', 14),
  ('PB', 'Paraíba', 15),
  ('PR', 'Paraná', 16),
  ('PE', 'Pernambuco', 17),
  ('PI', 'Piauí', 18),
  ('RJ', 'Rio de Janeiro', 19),
  ('RN', 'Rio Grande do Norte', 20),
  ('RS', 'Rio Grande do Sul', 21),
  ('RO', 'Rondônia', 22),
  ('RR', 'Roraima', 23),
  ('SC', 'Santa Catarina', 24),
  ('SP', 'São Paulo', 25),
  ('SE', 'Sergipe', 26),
  ('TO', 'Tocantins', 27)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    active = TRUE;
