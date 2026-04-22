-- DeckFarm Migration 011: Soft delete for aplicacoes
-- Never hard-delete application records — allows audit, recovery, and prevents
-- "ghost resurrection" when the sync pull (bulkPut) restores Supabase records.

ALTER TABLE public.aplicacoes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_aplicacoes_deleted_at ON public.aplicacoes(deleted_at);

-- View that hides soft-deleted rows (optional convenience)
CREATE OR REPLACE VIEW public.aplicacoes_ativas AS
  SELECT * FROM public.aplicacoes WHERE deleted_at IS NULL;
