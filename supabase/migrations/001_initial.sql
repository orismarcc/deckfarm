-- DeckFarm - Supabase Initial Migration
-- Run this on your Supabase project's SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  senha       TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'agronomo'
                CHECK (tipo IN ('admin', 'agronomo', 'tecnico', 'operador')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FAZENDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fazendas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT NOT NULL,
  localizacao  TEXT NOT NULL,
  area_total   NUMERIC,
  latitude     NUMERIC,
  longitude    NUMERIC,
  usuario_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fazendas_usuario ON public.fazendas(usuario_id);

-- ============================================================
-- TALHOES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.talhoes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT NOT NULL,
  area         NUMERIC NOT NULL,
  cultura      TEXT NOT NULL
                 CHECK (cultura IN ('soja','milho','milho_safrinha','gergelim','feijao','algodao')),
  fazenda_id   UUID NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  latitude     NUMERIC,
  longitude    NUMERIC,
  coordenadas  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_talhoes_fazenda ON public.talhoes(fazenda_id);

-- ============================================================
-- PRODUTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.produtos (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                    TEXT NOT NULL,
  tipo                    TEXT NOT NULL
                            CHECK (tipo IN ('herbicida','fertilizante','defensivo','fungicida','inseticida')),
  prazo_medio_aplicacao   INTEGER NOT NULL DEFAULT 21,
  fabricante              TEXT,
  registro_mapa           TEXT,
  unidade                 TEXT,
  fazenda_id              UUID NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_produtos_fazenda ON public.produtos(fazenda_id);

-- ============================================================
-- APLICACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.aplicacoes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talhao_id           UUID NOT NULL REFERENCES public.talhoes(id) ON DELETE CASCADE,
  produto_id          UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  data_aplicacao      DATE NOT NULL,
  proxima_aplicacao   DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'dentro_do_prazo'
                        CHECK (status IN ('dentro_do_prazo','proximo','hoje','atrasado')),
  dose                NUMERIC,
  unidade_dose        TEXT,
  area_aplicada       NUMERIC,
  responsavel         TEXT,
  observacoes         TEXT,
  clima               TEXT,
  temperatura         NUMERIC,
  usuario_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_talhao  ON public.aplicacoes(talhao_id);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_usuario ON public.aplicacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_proxima ON public.aplicacoes(proxima_aplicacao);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_status  ON public.aplicacoes(status);

-- ============================================================
-- NOTIFICACOES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo             TEXT NOT NULL
                     CHECK (tipo IN ('semana','tres_dias','amanha','hoje','atrasado')),
  mensagem         TEXT NOT NULL,
  data_referencia  DATE NOT NULL,
  lida             BOOLEAN NOT NULL DEFAULT FALSE,
  usuario_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  aplicacao_id     UUID REFERENCES public.aplicacoes(id) ON DELETE CASCADE,
  talhao_id        UUID REFERENCES public.talhoes(id) ON DELETE CASCADE,
  fazenda_id       UUID REFERENCES public.fazendas(id) ON DELETE CASCADE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON public.notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida    ON public.notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_data    ON public.notificacoes(data_referencia);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazendas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talhoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aplicacoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Since we use JWT-based auth from our own backend (not Supabase Auth),
-- the service_role key bypasses RLS. These policies are for direct access:

CREATE POLICY "service_role_all" ON public.users        FOR ALL USING (true);
CREATE POLICY "service_role_all" ON public.fazendas     FOR ALL USING (true);
CREATE POLICY "service_role_all" ON public.talhoes      FOR ALL USING (true);
CREATE POLICY "service_role_all" ON public.produtos     FOR ALL USING (true);
CREATE POLICY "service_role_all" ON public.aplicacoes   FOR ALL USING (true);
CREATE POLICY "service_role_all" ON public.notificacoes FOR ALL USING (true);

-- ============================================================
-- FUNCTION: auto-update status based on date
-- ============================================================
CREATE OR REPLACE FUNCTION update_aplicacao_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proxima_aplicacao = CURRENT_DATE THEN
    NEW.status := 'hoje';
  ELSIF NEW.proxima_aplicacao < CURRENT_DATE THEN
    NEW.status := 'atrasado';
  ELSIF NEW.proxima_aplicacao <= CURRENT_DATE + INTERVAL '7 days' THEN
    NEW.status := 'proximo';
  ELSE
    NEW.status := 'dentro_do_prazo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aplicacao_status
  BEFORE INSERT OR UPDATE OF proxima_aplicacao ON public.aplicacoes
  FOR EACH ROW EXECUTE FUNCTION update_aplicacao_status();

-- ============================================================
-- NOTES FOR SETUP
-- ============================================================
-- 1. Go to your Supabase project > SQL Editor > paste this script > Run
-- 2. Copy your Project URL and anon key to .env.local:
--    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
--    SUPABASE_SERVICE_ROLE_KEY=eyJ...
--    JWT_SECRET=your-random-secret-at-least-32-chars
-- 3. The app works fully offline without Supabase — data syncs when online.
