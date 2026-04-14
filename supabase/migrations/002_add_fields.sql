-- DeckFarm - Migration 002: Novos campos
-- Aplicado automaticamente pelo sistema de migração do app
-- Também pode ser rodado manualmente no Supabase SQL Editor

-- ── users: apelido ──────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS apelido TEXT;

-- ── fazendas: nome_produtor ──────────────────────────────────────────
ALTER TABLE public.fazendas
  ADD COLUMN IF NOT EXISTS nome_produtor TEXT;

-- ── talhoes: descricao, foto ─────────────────────────────────────────
ALTER TABLE public.talhoes
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS foto      TEXT; -- base64 comprimido

-- ── aplicacoes: safra_id, fotos ──────────────────────────────────────
ALTER TABLE public.aplicacoes
  ADD COLUMN IF NOT EXISTS safra_id TEXT,
  ADD COLUMN IF NOT EXISTS fotos    TEXT; -- JSON array de base64

-- ── safras ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.safras (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                     TEXT NOT NULL,
  ano_inicio               INTEGER NOT NULL,
  ano_fim                  INTEGER NOT NULL,
  fazenda_id               UUID NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  cultura                  TEXT NOT NULL,
  area_plantada            NUMERIC,
  data_plantio             DATE,
  data_colheita_prevista   DATE,
  data_colheita_real       DATE,
  status                   TEXT NOT NULL DEFAULT 'planejada'
                             CHECK (status IN ('planejada','em_andamento','finalizada')),
  produtividade_media      NUMERIC,
  observacoes              TEXT,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_safras_fazenda ON public.safras(fazenda_id);
ALTER TABLE public.safras ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON public.safras FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── fazenda_membros ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fazenda_membros (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fazenda_id     UUID NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  usuario_id     UUID,
  usuario_nome   TEXT,
  usuario_email  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'operador'
                   CHECK (role IN ('admin','agronomo','tecnico','operador')),
  status         TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','ativo','inativo')),
  convidado_por  UUID,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_membros_fazenda ON public.fazenda_membros(fazenda_id);
ALTER TABLE public.fazenda_membros ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all" ON public.fazenda_membros FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Função exec_migration (permite que o app aplique DDL via RPC) ──────
CREATE OR REPLACE FUNCTION public.exec_migration(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Apenas o service_role pode chamar esta função
REVOKE ALL ON FUNCTION public.exec_migration(text) FROM PUBLIC;
