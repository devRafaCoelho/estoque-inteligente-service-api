-- Migração: perfil expandido (nome/sobrenome + endereço/contato).
-- Apaga todos os usuários e dados ligados (CASCADE).

BEGIN;

TRUNCATE TABLE users CASCADE;

ALTER TABLE users DROP COLUMN IF EXISTS name;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cpf CHAR(11),
  ADD COLUMN IF NOT EXISTS zip_code CHAR(8),
  ADD COLUMN IF NOT EXISTS street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS street_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complement VARCHAR(120),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(120),
  ADD COLUMN IF NOT EXISTS city VARCHAR(120);

-- Após truncate a tabela está vazia; garante NOT NULL em first_name.
ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_active ON users (cpf)
  WHERE cpf IS NOT NULL AND status = 'active';

COMMIT;
