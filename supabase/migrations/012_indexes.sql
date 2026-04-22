-- DeckFarm Migration 012: Performance indexes on all hot query paths

-- aplicacoes (most queried table)
CREATE INDEX IF NOT EXISTS idx_aplicacoes_talhao_id     ON public.aplicacoes(talhao_id);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_usuario_id    ON public.aplicacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_status        ON public.aplicacoes(status);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_data          ON public.aplicacoes(data_aplicacao);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_proxima       ON public.aplicacoes(proxima_aplicacao);
CREATE INDEX IF NOT EXISTS idx_aplicacoes_tipo          ON public.aplicacoes(tipo);
-- compound: dashboard "urgent applications for user"
CREATE INDEX IF NOT EXISTS idx_aplicacoes_usuario_status ON public.aplicacoes(usuario_id, status)
  WHERE deleted_at IS NULL;

-- talhoes
CREATE INDEX IF NOT EXISTS idx_talhoes_fazenda_id   ON public.talhoes(fazenda_id);
CREATE INDEX IF NOT EXISTS idx_talhoes_cultura      ON public.talhoes(cultura);

-- produtos
CREATE INDEX IF NOT EXISTS idx_produtos_fazenda_id  ON public.produtos(fazenda_id);

-- fazendas
CREATE INDEX IF NOT EXISTS idx_fazendas_usuario_id  ON public.fazendas(usuario_id);

-- notificacoes
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida ON public.notificacoes(usuario_id, lida);

-- semeadura_etapas
CREATE INDEX IF NOT EXISTS idx_semeadura_talhao ON public.semeadura_etapas(talhao_id);
