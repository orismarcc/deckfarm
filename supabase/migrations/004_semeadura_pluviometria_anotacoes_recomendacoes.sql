-- Migration 004: semeadura, pluviometria, anotações, recomendações
-- Apply at: Supabase SQL Editor

-- ── Talhão: semeadura ─────────────────────────────────────────────────────────
ALTER TABLE talhoes
  ADD COLUMN IF NOT EXISTS status_semeadura text CHECK (status_semeadura IN ('nao_iniciada', 'em_andamento', 'finalizada')),
  ADD COLUMN IF NOT EXISTS area_semeada     numeric(10,2);

-- ── Pluviômetros ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pluviometros (
  id           text PRIMARY KEY,
  nome         text NOT NULL,
  fazenda_id   text NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  talhao_id    text REFERENCES talhoes(id) ON DELETE SET NULL,
  latitude     numeric(9,6),
  longitude    numeric(9,6),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  _sync_status text DEFAULT 'synced'
);

ALTER TABLE pluviometros ENABLE ROW LEVEL SECURITY;
CREATE POLICY pluviometros_owner ON pluviometros
  USING (fazenda_id IN (SELECT id FROM fazendas WHERE usuario_id = auth.uid()::text));

-- ── Registros de Chuva ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registros_chuva (
  id              text PRIMARY KEY,
  pluviometro_id  text NOT NULL REFERENCES pluviometros(id) ON DELETE CASCADE,
  fazenda_id      text NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  data            date NOT NULL,
  volume_mm       numeric(6,2) NOT NULL,
  observacoes     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE registros_chuva ENABLE ROW LEVEL SECURITY;
CREATE POLICY registros_chuva_owner ON registros_chuva
  USING (fazenda_id IN (SELECT id FROM fazendas WHERE usuario_id = auth.uid()::text));

CREATE INDEX IF NOT EXISTS idx_registros_chuva_pluviometro ON registros_chuva(pluviometro_id);
CREATE INDEX IF NOT EXISTS idx_registros_chuva_data ON registros_chuva(data);

-- ── Anotações ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anotacoes (
  id          text PRIMARY KEY,
  talhao_id   text NOT NULL REFERENCES talhoes(id) ON DELETE CASCADE,
  fazenda_id  text NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  usuario_id  text NOT NULL,
  texto       text NOT NULL,
  fotos       jsonb DEFAULT '[]',
  data        date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  _sync_status text DEFAULT 'synced'
);

ALTER TABLE anotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY anotacoes_owner ON anotacoes
  USING (usuario_id = auth.uid()::text);

CREATE INDEX IF NOT EXISTS idx_anotacoes_talhao ON anotacoes(talhao_id);
CREATE INDEX IF NOT EXISTS idx_anotacoes_data ON anotacoes(data);

-- ── Recomendações (agrônomo) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recomendacoes (
  id          text PRIMARY KEY,
  fazenda_id  text NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  usuario_id  text NOT NULL,
  nome        text NOT NULL,
  data_inicio date NOT NULL,
  data_fim    date NOT NULL,
  observacoes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  _sync_status text DEFAULT 'synced'
);

ALTER TABLE recomendacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY recomendacoes_owner ON recomendacoes
  USING (usuario_id = auth.uid()::text);

-- ── Aplicações das Recomendações ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recomendacao_aplicacoes (
  id                text PRIMARY KEY,
  recomendacao_id   text NOT NULL REFERENCES recomendacoes(id) ON DELETE CASCADE,
  talhao_id         text NOT NULL REFERENCES talhoes(id) ON DELETE CASCADE,
  produto_id        text NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  data_aplicacao    date NOT NULL,
  dose              numeric(10,4),
  unidade_dose      text,
  observacoes       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recomendacao_aplicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY recomendacao_aplicacoes_owner ON recomendacao_aplicacoes
  USING (recomendacao_id IN (SELECT id FROM recomendacoes WHERE usuario_id = auth.uid()::text));

CREATE INDEX IF NOT EXISTS idx_rec_aplicacoes_recomendacao ON recomendacao_aplicacoes(recomendacao_id);
CREATE INDEX IF NOT EXISTS idx_rec_aplicacoes_talhao ON recomendacao_aplicacoes(talhao_id);
CREATE INDEX IF NOT EXISTS idx_rec_aplicacoes_data ON recomendacao_aplicacoes(data_aplicacao);
