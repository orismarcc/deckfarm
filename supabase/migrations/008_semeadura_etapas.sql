-- Migration 008: semeadura_etapas
-- Multi-stage sowing tracking per talhão.
-- Each row represents one sowing stage (1ª etapa, 2ª etapa, …).
-- The talhão's cached area_semeada and status_semeadura are kept in sync
-- by the application layer whenever a new etapa is saved.

CREATE TABLE IF NOT EXISTS semeadura_etapas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talhao_id        UUID NOT NULL REFERENCES talhoes(id) ON DELETE CASCADE,
  fazenda_id       UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  usuario_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  etapa            INTEGER NOT NULL,          -- stage number: 1, 2, 3, …
  area_semeada     NUMERIC(10,4) NOT NULL,    -- hectares planted in THIS stage
  data_semeadura   DATE NOT NULL,
  observacoes      TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent two stages with the same number on the same talhão
CREATE UNIQUE INDEX IF NOT EXISTS semeadura_etapas_talhao_etapa_unique
  ON semeadura_etapas(talhao_id, etapa);

-- RLS
ALTER TABLE semeadura_etapas ENABLE ROW LEVEL SECURITY;

-- Users may only see/write their own etapas
CREATE POLICY "semeadura_etapas_owner" ON semeadura_etapas
  USING      (usuario_id = auth.uid()::UUID)
  WITH CHECK (usuario_id = auth.uid()::UUID);
