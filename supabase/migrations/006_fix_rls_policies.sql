-- Migration 006: Fix RLS policy type mismatches (uuid = text)
-- The fazendas.usuario_id column is UUID; auth.uid() returns UUID.
-- Subqueries that compare uuid with ::text fail.

-- Fix pluviometros RLS
DROP POLICY IF EXISTS pluviometros_owner ON pluviometros;
CREATE POLICY pluviometros_owner ON pluviometros
  USING (fazenda_id::text IN (SELECT id::text FROM fazendas WHERE usuario_id = auth.uid()));

-- Fix registros_chuva RLS
DROP POLICY IF EXISTS registros_chuva_owner ON registros_chuva;
CREATE POLICY registros_chuva_owner ON registros_chuva
  USING (fazenda_id::text IN (SELECT id::text FROM fazendas WHERE usuario_id = auth.uid()));

-- Fix recomendacao_aplicacoes RLS
DROP POLICY IF EXISTS recomendacao_aplicacoes_owner ON recomendacao_aplicacoes;
CREATE POLICY recomendacao_aplicacoes_owner ON recomendacao_aplicacoes
  USING (recomendacao_id IN (SELECT id FROM recomendacoes WHERE usuario_id = auth.uid()::text));

-- anotacoes and recomendacoes use usuario_id text column, so auth.uid()::text is correct — leave as-is.
