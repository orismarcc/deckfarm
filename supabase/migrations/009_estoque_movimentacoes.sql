CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  fazenda_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade NUMERIC(12,4) NOT NULL,
  quantidade_anterior NUMERIC(12,4) NOT NULL,
  quantidade_nova NUMERIC(12,4) NOT NULL,
  motivo TEXT,
  data DATE NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estoque_mov_owner" ON estoque_movimentacoes
  USING (usuario_id = auth.uid()::UUID)
  WITH CHECK (usuario_id = auth.uid()::UUID);
