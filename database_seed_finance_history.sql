-- =============================================================
-- Seed financeiro histórico (Jan–Jun do ano corrente)
-- Usuário: ebe9bae6-608f-4c36-9d56-b292c8ea6a67
--
-- Pré-requisito: usuário + produtos do database_seed.sql
--   psql "$DATABASE_URL" -f database_seed_finance_history.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_user UUID := 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
  v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user) THEN
    RAISE EXCEPTION 'Usuário % não encontrado.', v_user;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE user_id = v_user AND id = '11111111-1111-4111-8111-111111111103'
  ) THEN
    RAISE EXCEPTION 'Produtos demo não encontrados. Rode database_seed.sql antes.';
  END IF;

  -- Remove compras históricas anteriores deste seed (IDs fixos)
  DELETE FROM purchase_items
  WHERE purchase_id IN (
    SELECT id FROM purchases
    WHERE user_id = v_user
      AND id::text LIKE '33333333-3333-4333-8333-3333333333%'
      AND id NOT IN (
        '33333333-3333-4333-8333-333333333301',
        '33333333-3333-4333-8333-333333333302'
      )
  );
  DELETE FROM purchases
  WHERE user_id = v_user
    AND id::text LIKE '33333333-3333-4333-8333-3333333333%'
    AND id NOT IN (
      '33333333-3333-4333-8333-333333333301',
      '33333333-3333-4333-8333-333333333302'
    );
END $$;

-- Jan — mercearia dominante
INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333311',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  NULL,
  'Assaí',
  make_timestamptz(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 14, 10, 30, 0, 'America/Sao_Paulo'),
  142.40,
  'BRL',
  'Seed histórico Jan'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111101',
   'Arroz tipo 1', 10, 'kg', 5.90, 59.00, 'grocery'),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111102',
   'Feijão carioca', 5, 'kg', 8.50, 42.50, 'grocery'),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 4, 'l', 4.79, 19.16, 'dairy'),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 4, 'un', 2.99, 11.96, 'cleaning'),
  ('33333333-3333-4333-8333-333333333311', '11111111-1111-4111-8111-111111111105',
   'Banana prata', 12, 'un', 0.80, 9.60, 'produce');

-- Fev — limpeza + higiene
INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333312',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  NULL,
  'Farmácia + Mercado',
  make_timestamptz(EXTRACT(YEAR FROM CURRENT_DATE)::int, 2, 10, 16, 0, 0, 'America/Sao_Paulo'),
  118.70,
  'BRL',
  'Seed histórico Fev'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 6, 'un', 2.99, 17.94, 'cleaning'),
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111115',
   'Água sanitária', 4, 'l', 6.50, 26.00, 'cleaning'),
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111112',
   'Papel higiênico', 2, 'pack', 18.90, 37.80, 'hygiene'),
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 4, 'l', 4.79, 19.16, 'dairy'),
  ('33333333-3333-4333-8333-333333333312', '11111111-1111-4111-8111-111111111106',
   'Refrigerante cola 2L', 2, 'bottle', 8.90, 17.80, 'beverages');

-- Mar — laticínios dominantes (~41%+)
INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333313',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  NULL,
  'Atacadão',
  make_timestamptz(EXTRACT(YEAR FROM CURRENT_DATE)::int, 3, 18, 11, 15, 0, 'America/Sao_Paulo'),
  156.20,
  'BRL',
  'Seed histórico Mar'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 8, 'l', 4.79, 38.32, 'dairy'),
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111104',
   'Queijo mussarela', 1, 'kg', 42.00, 42.00, 'dairy'),
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111101',
   'Arroz tipo 1', 5, 'kg', 5.90, 29.50, 'grocery'),
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111105',
   'Banana prata', 15, 'un', 0.80, 12.00, 'produce'),
  ('33333333-3333-4333-8333-333333333313', '11111111-1111-4111-8111-111111111108',
   'Pizza calabresa', 2, 'un', 17.19, 34.38, 'frozen');

-- Abr — hortifruti + bebidas
INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333314',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  NULL,
  'Hortifruti Central',
  make_timestamptz(EXTRACT(YEAR FROM CURRENT_DATE)::int, 4, 8, 9, 45, 0, 'America/Sao_Paulo'),
  97.55,
  'BRL',
  'Seed histórico Abr'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111105',
   'Banana prata', 20, 'un', 0.80, 16.00, 'produce'),
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111113',
   'Tomate', 3, 'kg', 7.50, 22.50, 'produce'),
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111106',
   'Refrigerante cola 2L', 4, 'bottle', 8.99, 35.96, 'beverages'),
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 3, 'l', 4.79, 14.37, 'dairy'),
  ('33333333-3333-4333-8333-333333333314', '11111111-1111-4111-8111-111111111102',
   'Feijão carioca', 1, 'kg', 8.50, 8.50, 'grocery');

-- Mai — congelados
INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333315',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  NULL,
  'Extra',
  make_timestamptz(EXTRACT(YEAR FROM CURRENT_DATE)::int, 5, 22, 18, 20, 0, 'America/Sao_Paulo'),
  131.80,
  'BRL',
  'Seed histórico Mai'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333315', '11111111-1111-4111-8111-111111111108',
   'Pizza calabresa', 4, 'un', 18.90, 75.60, 'frozen'),
  ('33333333-3333-4333-8333-333333333315', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 4, 'l', 4.79, 19.16, 'dairy'),
  ('33333333-3333-4333-8333-333333333315', '11111111-1111-4111-8111-111111111101',
   'Arroz tipo 1', 3, 'kg', 5.90, 17.70, 'grocery'),
  ('33333333-3333-4333-8333-333333333315', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 3, 'un', 2.99, 8.97, 'cleaning'),
  ('33333333-3333-4333-8333-333333333315', '11111111-1111-4111-8111-111111111106',
   'Refrigerante cola 2L', 1, 'bottle', 10.37, 10.37, 'beverages');

-- Jun — misto equilibrado
INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333316',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  NULL,
  'Carrefour',
  make_timestamptz(EXTRACT(YEAR FROM CURRENT_DATE)::int, 6, 12, 12, 0, 0, 'America/Sao_Paulo'),
  124.90,
  'BRL',
  'Seed histórico Jun'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111114',
   'Café torrado', 2, 'pack', 16.90, 33.80, 'grocery'),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 6, 'l', 4.79, 28.74, 'dairy'),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111112',
   'Papel higiênico', 1, 'pack', 18.90, 18.90, 'hygiene'),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111105',
   'Banana prata', 18, 'un', 0.80, 14.40, 'produce'),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111108',
   'Pizza calabresa', 1, 'un', 18.90, 18.90, 'frozen'),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 2, 'un', 2.99, 5.98, 'cleaning'),
  ('33333333-3333-4333-8333-333333333316', '11111111-1111-4111-8111-111111111106',
   'Refrigerante cola 2L', 1, 'bottle', 4.18, 4.18, 'beverages');

COMMIT;
