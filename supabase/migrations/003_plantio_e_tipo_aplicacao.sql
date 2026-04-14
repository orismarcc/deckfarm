-- Migration 003: Add plantio fields to talhoes and tipo to aplicacoes
-- Run with: npm run db:push

-- ── talhoes ──────────────────────────────────────────────────────────────────

ALTER TABLE talhoes
  ADD COLUMN IF NOT EXISTS data_plantio            date,
  ADD COLUMN IF NOT EXISTS data_colheita_prevista  date,
  ADD COLUMN IF NOT EXISTS data_colheita_real      date;

-- Index for quick lookups by planting date
CREATE INDEX IF NOT EXISTS idx_talhoes_data_plantio
  ON talhoes (data_plantio)
  WHERE data_plantio IS NOT NULL;

-- ── aplicacoes ───────────────────────────────────────────────────────────────

-- 'planejada' = auto-scheduled by the agronomic engine
-- 'realizada' = completed by the user
ALTER TABLE aplicacoes
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('planejada', 'realizada'));

-- Index for filtering by tipo
CREATE INDEX IF NOT EXISTS idx_aplicacoes_tipo
  ON aplicacoes (tipo)
  WHERE tipo IS NOT NULL;

-- ── notificacoes tipo ────────────────────────────────────────────────────────

-- Ensure the tipo column exists on notificacoes (may already be present from 002)
ALTER TABLE notificacoes
  ADD COLUMN IF NOT EXISTS tipo text;

-- ── safras (if not yet present from 002) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS safras (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                   text NOT NULL,
  ano_inicio             integer NOT NULL,
  ano_fim                integer NOT NULL,
  fazenda_id             uuid NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  cultura                text NOT NULL,
  area_plantada          numeric,
  data_plantio           date,
  data_colheita_prevista date,
  data_colheita_real     date,
  status                 text NOT NULL DEFAULT 'em_andamento'
                           CHECK (status IN ('planejada','em_andamento','finalizada')),
  produtividade_media    numeric,
  observacoes            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  _sync_status           text DEFAULT 'synced'
);

CREATE INDEX IF NOT EXISTS idx_safras_fazenda_id ON safras (fazenda_id);
CREATE INDEX IF NOT EXISTS idx_safras_ano_inicio  ON safras (ano_inicio);

ALTER TABLE safras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safras' AND policyname = 'safras_owner'
  ) THEN
    CREATE POLICY safras_owner ON safras
      USING (
        fazenda_id IN (
          SELECT id FROM fazendas WHERE usuario_id = auth.uid()
        )
      );
  END IF;
END $$;
