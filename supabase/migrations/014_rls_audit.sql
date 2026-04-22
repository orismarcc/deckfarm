-- Migration 014: RLS Audit — ensure every table has Row Level Security
-- All user data is scoped to the authenticated user (auth.uid()).

-- ── Enable RLS everywhere ─────────────────────────────────────────────────────

ALTER TABLE IF EXISTS fazendas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS talhoes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produtos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aplicacoes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notificacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS safras                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS semeadura_etapas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS estoque_movimentacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fazenda_membros        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recomendacoes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recomendacao_aplicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pluviometros           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS registro_chuvas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS anotacoes              ENABLE ROW LEVEL SECURITY;

-- ── Fazendas: owned by usuario_id OR member ──────────────────────────────────

DROP POLICY IF EXISTS fazendas_owner      ON fazendas;
DROP POLICY IF EXISTS fazendas_member     ON fazendas;

CREATE POLICY fazendas_owner ON fazendas
  USING (usuario_id = auth.uid());

CREATE POLICY fazendas_member ON fazendas
  USING (
    id IN (
      SELECT fazenda_id FROM fazenda_membros
      WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

-- ── Talhoes: via fazenda membership ─────────────────────────────────────────

DROP POLICY IF EXISTS talhoes_access ON talhoes;

CREATE POLICY talhoes_access ON talhoes
  USING (
    fazenda_id IN (
      SELECT id FROM fazendas WHERE usuario_id = auth.uid()
      UNION
      SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

-- ── Produtos: via fazenda ────────────────────────────────────────────────────

DROP POLICY IF EXISTS produtos_access ON produtos;

CREATE POLICY produtos_access ON produtos
  USING (
    fazenda_id IN (
      SELECT id FROM fazendas WHERE usuario_id = auth.uid()
      UNION
      SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

-- ── Aplicações: via talhão → fazenda ────────────────────────────────────────

DROP POLICY IF EXISTS aplicacoes_access ON aplicacoes;

CREATE POLICY aplicacoes_access ON aplicacoes
  USING (
    talhao_id IN (
      SELECT id FROM talhoes
      WHERE fazenda_id IN (
        SELECT id FROM fazendas WHERE usuario_id = auth.uid()
        UNION
        SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
      )
    )
  );

-- ── Notificações: owned by user ──────────────────────────────────────────────

DROP POLICY IF EXISTS notificacoes_access ON notificacoes;

CREATE POLICY notificacoes_access ON notificacoes
  USING (usuario_id = auth.uid());

-- ── Safras: via fazenda ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS safras_access ON safras;

CREATE POLICY safras_access ON safras
  USING (
    fazenda_id IN (
      SELECT id FROM fazendas WHERE usuario_id = auth.uid()
      UNION
      SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

-- ── Semeadura etapas: owned by user ─────────────────────────────────────────

DROP POLICY IF EXISTS semeadura_etapas_access ON semeadura_etapas;

CREATE POLICY semeadura_etapas_access ON semeadura_etapas
  USING (usuario_id = auth.uid());

-- ── Estoque movimentações: via fazenda ──────────────────────────────────────

DROP POLICY IF EXISTS estoque_mov_access ON estoque_movimentacoes;

CREATE POLICY estoque_mov_access ON estoque_movimentacoes
  USING (
    fazenda_id IN (
      SELECT id FROM fazendas WHERE usuario_id = auth.uid()
      UNION
      SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

-- ── Fazenda membros: owner can manage, members can read own row ──────────────

DROP POLICY IF EXISTS fazenda_membros_owner  ON fazenda_membros;
DROP POLICY IF EXISTS fazenda_membros_member ON fazenda_membros;

CREATE POLICY fazenda_membros_owner ON fazenda_membros
  USING (
    fazenda_id IN (SELECT id FROM fazendas WHERE usuario_id = auth.uid())
  );

CREATE POLICY fazenda_membros_member ON fazenda_membros
  FOR SELECT USING (usuario_id = auth.uid());

-- ── Recomendações: owned by user ─────────────────────────────────────────────

DROP POLICY IF EXISTS recomendacoes_access ON recomendacoes;
CREATE POLICY recomendacoes_access ON recomendacoes USING (usuario_id = auth.uid());

-- ── Pluviômetros & chuvas: via fazenda ───────────────────────────────────────

DROP POLICY IF EXISTS pluviometros_access ON pluviometros;
CREATE POLICY pluviometros_access ON pluviometros
  USING (
    fazenda_id IN (
      SELECT id FROM fazendas WHERE usuario_id = auth.uid()
      UNION
      SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

DROP POLICY IF EXISTS registro_chuvas_access ON registro_chuvas;
CREATE POLICY registro_chuvas_access ON registro_chuvas
  USING (
    fazenda_id IN (
      SELECT id FROM fazendas WHERE usuario_id = auth.uid()
      UNION
      SELECT fazenda_id FROM fazenda_membros WHERE usuario_id = auth.uid() AND status = 'ativo'
    )
  );

-- ── Anotações: owned by user ─────────────────────────────────────────────────

DROP POLICY IF EXISTS anotacoes_access ON anotacoes;
CREATE POLICY anotacoes_access ON anotacoes USING (usuario_id = auth.uid());
