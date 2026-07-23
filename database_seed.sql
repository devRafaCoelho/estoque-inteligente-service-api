-- =============================================================
-- Seed de demonstração — Estoque Inteligente
-- Usuário: ebe9bae6-608f-4c36-9d56-b292c8ea6a67
--
-- Pré-requisito: database.sql aplicado e o usuário já cadastrado.
--   psql "$DATABASE_URL" -f database_seed.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_user UUID := 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user) THEN
    RAISE EXCEPTION 'Usuário % não encontrado. Cadastre-o antes do seed.', v_user;
  END IF;
END $$;

-- Limpa dados demo anteriores deste usuário (mantém a conta)
DELETE FROM chat_messages
WHERE session_id IN (
  SELECT id FROM chat_sessions WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67'
);
DELETE FROM chat_sessions WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM notifications WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM shopping_list_items
WHERE shopping_list_id IN (
  SELECT id FROM shopping_lists WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67'
);
DELETE FROM shopping_lists WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM purchase_items
WHERE purchase_id IN (
  SELECT id FROM purchases WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67'
);
DELETE FROM purchases WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM stock_movements WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM stock_out_items
WHERE stock_out_id IN (
  SELECT id FROM stock_outs WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67'
);
DELETE FROM stock_outs WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM stock_intake_items
WHERE intake_id IN (
  SELECT id FROM stock_intakes WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67'
);
DELETE FROM stock_intakes WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM product_aliases WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';
DELETE FROM products WHERE user_id = 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67';

-- Preferências (upsert)
INSERT INTO user_preferences (
  user_id,
  notify_low_stock,
  notify_out_of_stock,
  notify_repurchase,
  notify_consumption_nudge,
  consumption_nudge_days,
  shopping_list_view_mode,
  currency,
  locale
) VALUES (
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  TRUE, TRUE, TRUE, TRUE, 5,
  'list', 'BRL', 'pt-BR'
)
ON CONFLICT (user_id) DO UPDATE SET
  notify_low_stock = EXCLUDED.notify_low_stock,
  notify_out_of_stock = EXCLUDED.notify_out_of_stock,
  notify_consumption_nudge = EXCLUDED.notify_consumption_nudge,
  consumption_nudge_days = EXCLUDED.consumption_nudge_days,
  updated_at = NOW();

-- -------------------------------------------------------------
-- Produtos (IDs fixos para referências)
-- -------------------------------------------------------------
INSERT INTO products (
  id, user_id, name, category, quantity, unit, min_quantity,
  avg_unit_price, last_purchased_at, last_consumed_at,
  avg_weekly_usage, consumption_cycle_days, repurchase_days, notes, active
) VALUES
  -- ok
  ('11111111-1111-4111-8111-111111111101', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Arroz tipo 1', 'grocery', 8, 'kg', 2, 5.90,
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '3 days', 1.5, 7, 21, 'Pacote 5kg', TRUE),
  ('11111111-1111-4111-8111-111111111102', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Feijão carioca', 'grocery', 4, 'kg', 1, 8.50,
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days', 0.8, 10, 30, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111103', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Leite integral', 'dairy', 10, 'l', 4, 4.79,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', 3.0, 3, 7, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111104', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Queijo mussarela', 'dairy', 0.6, 'kg', 0.2, 42.00,
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', 0.15, 5, 10, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111105', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Banana prata', 'produce', 12, 'un', 4, 0.80,
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', 5, 2, 5, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111106', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Refrigerante cola 2L', 'beverages', 4, 'bottle', 2, 8.99,
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '4 days', 1, 7, 14, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111107', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Sabonete em barra', 'hygiene', 9, 'un', 3, 2.50,
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '6 days', 1, 7, 30, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111108', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Pizza calabresa', 'frozen', 3, 'un', 1, 18.90,
   NOW() - INTERVAL '10 days', NULL, NULL, NULL, 20, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111109', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Lâmpada LED 9W', 'household', 6, 'un', 2, 12.00,
   NOW() - INTERVAL '40 days', NULL, NULL, NULL, 90, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111110', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Ração cães 1kg', 'other', 2, 'kg', 1, 29.90,
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days', 0.5, 7, 20, NULL, TRUE),
  -- low
  ('11111111-1111-4111-8111-111111111111', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Detergente neutro', 'cleaning', 1, 'un', 2, 2.99,
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '4 days', 0.5, 10, 20, 'Acabando', TRUE),
  ('11111111-1111-4111-8111-111111111112', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Papel higiênico', 'hygiene', 2, 'pack', 3, 22.00,
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days', 0.4, 8, 15, NULL, TRUE),
  ('11111111-1111-4111-8111-111111111113', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Tomate', 'produce', 3, 'un', 5, 1.20,
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 4, 2, 4, NULL, TRUE),
  -- out
  ('11111111-1111-4111-8111-111111111114', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Café torrado', 'grocery', 0, 'pack', 1, 18.50,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days', 0.5, 7, 14, 'Zerado', TRUE),
  ('11111111-1111-4111-8111-111111111115', 'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
   'Água sanitária', 'cleaning', 0, 'l', 1, 6.50,
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '8 days', 0.3, 14, 21, NULL, TRUE);

INSERT INTO product_aliases (user_id, product_id, alias) VALUES
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111101', 'arroz'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111103', 'leite'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111114', 'café'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111111', 'detergente');

-- -------------------------------------------------------------
-- Entrada confirmada + compra (financeiro)
-- -------------------------------------------------------------
INSERT INTO stock_intakes (
  id, user_id, source, status, raw_input, raw_payload, state_code, confirmed_at, created_at, updated_at
) VALUES (
  '22222222-2222-4222-8222-222222222201',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  'natural_language',
  'confirmed',
  'Comprei arroz, feijão, leite, detergente e banana no Extra',
  '{"storeName":"Extra Hipermercado"}'::jsonb,
  'BA',
  NOW() - INTERVAL '12 days',
  NOW() - INTERVAL '12 days',
  NOW() - INTERVAL '12 days'
);

INSERT INTO stock_intake_items (
  intake_id, product_id, name, quantity, unit, category, unit_price,
  confidence, matched_existing, excluded, sort_order
) VALUES
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101',
   'Arroz tipo 1', 5, 'kg', 'grocery', 5.90, 0.95, TRUE, FALSE, 0),
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111102',
   'Feijão carioca', 2, 'kg', 'grocery', 8.50, 0.93, TRUE, FALSE, 1),
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 6, 'l', 'dairy', 4.79, 0.97, TRUE, FALSE, 2),
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 3, 'un', 'cleaning', 2.99, 0.90, TRUE, FALSE, 3),
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111105',
   'Banana prata', 12, 'un', 'produce', 0.80, 0.88, TRUE, FALSE, 4);

INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency, notes
) VALUES (
  '33333333-3333-4333-8333-333333333301',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  '22222222-2222-4222-8222-222222222201',
  'Extra Hipermercado',
  NOW() - INTERVAL '12 days',
  84.17,
  'BRL',
  'Compra mensal'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111101',
   'Arroz tipo 1', 5, 'kg', 5.90, 29.50, 'grocery'),
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111102',
   'Feijão carioca', 2, 'kg', 8.50, 17.00, 'grocery'),
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 6, 'l', 4.79, 28.74, 'dairy'),
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 3, 'un', 2.99, 8.97, 'cleaning'),
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111105',
   'Banana prata', 12, 'un', 0.80, 9.60, 'produce');

-- Segunda compra (mês atual) para o gráfico financeiro
INSERT INTO stock_intakes (
  id, user_id, source, status, raw_input, raw_payload, state_code, confirmed_at, created_at, updated_at
) VALUES (
  '22222222-2222-4222-8222-222222222202',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  'natural_language',
  'confirmed',
  'Comprei leite, queijo, refrigerante e pizza',
  '{"storeName":"Atacadão"}'::jsonb,
  'BA',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
);

INSERT INTO stock_intake_items (
  intake_id, product_id, name, quantity, unit, category, unit_price,
  confidence, matched_existing, excluded, sort_order
) VALUES
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 4, 'l', 'dairy', 4.79, 0.96, TRUE, FALSE, 0),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111104',
   'Queijo mussarela', 0.5, 'kg', 'dairy', 42.00, 0.91, TRUE, FALSE, 1),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111106',
   'Refrigerante cola 2L', 3, 'bottle', 'beverages', 8.99, 0.94, TRUE, FALSE, 2),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111108',
   'Pizza calabresa', 2, 'un', 'frozen', 18.90, 0.89, TRUE, FALSE, 3);

INSERT INTO purchases (
  id, user_id, intake_id, store_name, purchased_at, total_amount, currency
) VALUES (
  '33333333-3333-4333-8333-333333333302',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  '22222222-2222-4222-8222-222222222202',
  'Atacadão',
  NOW() - INTERVAL '5 days',
  85.35,
  'BRL'
);

INSERT INTO purchase_items (
  purchase_id, product_id, name, quantity, unit, unit_price, line_total, category
) VALUES
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 4, 'l', 4.79, 19.16, 'dairy'),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111104',
   'Queijo mussarela', 0.5, 'kg', 42.00, 21.00, 'dairy'),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111106',
   'Refrigerante cola 2L', 3, 'bottle', 8.99, 26.97, 'beverages'),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111108',
   'Pizza calabresa', 2, 'un', 18.90, 37.80, 'frozen');

-- -------------------------------------------------------------
-- Baixa confirmada
-- -------------------------------------------------------------
INSERT INTO stock_outs (
  id, user_id, source, status, raw_input, confirmed_at, created_at, updated_at
) VALUES (
  '44444444-4444-4444-8444-444444444401',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  'natural_language',
  'confirmed',
  'Usei 1 detergente e acabei o café',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
);

INSERT INTO stock_out_items (
  stock_out_id, product_id, name, quantity, unit,
  confidence, matched_existing, available_qty, excluded, sort_order
) VALUES
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 1, 'un', 0.95, TRUE, 2, FALSE, 0),
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111114',
   'Café torrado', 1, 'pack', 0.97, TRUE, 1, FALSE, 1);

-- -------------------------------------------------------------
-- Movimentos
-- -------------------------------------------------------------
INSERT INTO stock_movements (
  user_id, product_id, intake_id, stock_out_id, type, quantity, unit,
  quantity_before, quantity_after, note, created_at
) VALUES
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111101',
   '22222222-2222-4222-8222-222222222201', NULL, 'in', 5, 'kg', 3, 8, 'Entrada Extra', NOW() - INTERVAL '12 days'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111103',
   '22222222-2222-4222-8222-222222222202', NULL, 'in', 4, 'l', 6, 10, 'Entrada Atacadão', NOW() - INTERVAL '5 days'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111111',
   NULL, '44444444-4444-4444-8444-444444444401', 'out', 1, 'un', 2, 1, 'Baixa detergente', NOW() - INTERVAL '2 days'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111114',
   NULL, '44444444-4444-4444-8444-444444444401', 'out', 1, 'pack', 1, 0, 'Baixa café', NOW() - INTERVAL '2 days'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', '11111111-1111-4111-8111-111111111103',
   NULL, NULL, 'out', 1, 'l', 11, 10, 'Consumo diário', NOW() - INTERVAL '1 day');

-- -------------------------------------------------------------
-- Lista de compras
-- -------------------------------------------------------------
INSERT INTO shopping_lists (
  id, user_id, title, status, generated_by, created_at, updated_at
) VALUES (
  '55555555-5555-4555-8555-555555555501',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  'Lista de compras',
  'active',
  'rules',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
);

INSERT INTO shopping_list_items (
  shopping_list_id, product_id, name, suggested_qty, unit, priority, origin, checked, sort_order
) VALUES
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111114',
   'Café torrado', 2, 'pack', 'high', 'out_of_stock', FALSE, 0),
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111115',
   'Água sanitária', 2, 'l', 'high', 'out_of_stock', FALSE, 1),
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111111',
   'Detergente neutro', 3, 'un', 'high', 'low_stock', FALSE, 2),
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111112',
   'Papel higiênico', 2, 'pack', 'medium', 'low_stock', FALSE, 3),
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111103',
   'Leite integral', 6, 'l', 'medium', 'repurchase_time', TRUE, 4),
  ('55555555-5555-4555-8555-555555555501', NULL,
   'Guardanapos', 1, 'pack', 'low', 'manual', FALSE, 5);

-- -------------------------------------------------------------
-- Notificações
-- -------------------------------------------------------------
INSERT INTO notifications (
  user_id, type, title, body, product_id, payload, read_at, created_at
) VALUES
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', 'out_of_stock',
   'Café torrado acabou',
   'O estoque de Café torrado está zerado. Adicione à lista de compras.',
   '11111111-1111-4111-8111-111111111114',
   '{"action":"open_product","productId":"11111111-1111-4111-8111-111111111114","quantity":0,"unit":"pack","minQuantity":1,"stockStatus":"out"}'::jsonb,
   NULL, NOW() - INTERVAL '1 day'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', 'out_of_stock',
   'Água sanitária acabou',
   'O estoque de Água sanitária está zerado.',
   '11111111-1111-4111-8111-111111111115',
   '{"action":"open_product","productId":"11111111-1111-4111-8111-111111111115","quantity":0,"unit":"l","minQuantity":1,"stockStatus":"out"}'::jsonb,
   NULL, NOW() - INTERVAL '2 days'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', 'low_stock',
   'Detergente acabando',
   'Restam 1 un de Detergente neutro (mínimo 2).',
   '11111111-1111-4111-8111-111111111111',
   '{"action":"open_product","productId":"11111111-1111-4111-8111-111111111111","quantity":1,"unit":"un","minQuantity":2,"stockStatus":"low"}'::jsonb,
   NULL, NOW() - INTERVAL '12 hours'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', 'low_stock',
   'Papel higiênico acabando',
   'Restam 2 pct de Papel higiênico (mínimo 3).',
   '11111111-1111-4111-8111-111111111112',
   '{"action":"open_product","productId":"11111111-1111-4111-8111-111111111112","quantity":2,"unit":"pack","minQuantity":3,"stockStatus":"low"}'::jsonb,
   NOW() - INTERVAL '6 hours', NOW() - INTERVAL '3 days'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', 'consumption_nudge',
   'Lembrete de baixa',
   'Já faz alguns dias sem registrar baixas. Atualize o estoque dos itens usados.',
   NULL,
   '{"action":"open_quick_consume","nudgeDays":5,"productsWithStock":true}'::jsonb,
   NULL, NOW() - INTERVAL '4 hours'),
  ('ebe9bae6-608f-4c36-9d56-b292c8ea6a67', 'system',
   'Bem-vindo ao Estoque Inteligente',
   'Seu estoque de demonstração está pronto. Explore entradas, baixas e a lista de compras.',
   NULL,
   '{}'::jsonb,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '11 days');

-- -------------------------------------------------------------
-- Chat (amostra)
-- -------------------------------------------------------------
INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (
  '66666666-6666-4666-8666-666666666601',
  'ebe9bae6-608f-4c36-9d56-b292c8ea6a67',
  'O que está acabando?',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
);

INSERT INTO chat_messages (session_id, role, content, created_at) VALUES
  ('66666666-6666-4666-8666-666666666601', 'user',
   'Quais produtos estão acabando?', NOW() - INTERVAL '1 day'),
  ('66666666-6666-4666-8666-666666666601', 'assistant',
   'Você tem 3 itens em atenção: Detergente neutro, Papel higiênico e Tomate. Café e Água sanitária estão zerados.',
   NOW() - INTERVAL '1 day' + INTERVAL '2 minutes');

COMMIT;
