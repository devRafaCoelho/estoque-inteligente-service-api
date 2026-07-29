-- F3-5.3 Observabilidade NF-e — garante tabela de logs (já prevista em database.sql)

CREATE TABLE IF NOT EXISTS nf_collector_logs (
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

CREATE INDEX IF NOT EXISTS idx_nf_collector_logs_state
  ON nf_collector_logs (state_code, created_at DESC);
