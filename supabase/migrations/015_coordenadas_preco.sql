-- Migration 015: GeoJSON coordinates on talhoes + unit price on produtos

-- GeoJSON string for map polygon drawing
ALTER TABLE talhoes
  ADD COLUMN IF NOT EXISTS coordenadas TEXT;

-- Unit price per product unit for financial module
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(10, 4);

COMMENT ON COLUMN talhoes.coordenadas   IS 'GeoJSON Polygon — coordinates drawn by user on the interactive map';
COMMENT ON COLUMN produtos.preco_unitario IS 'Price per unit (R$) — used by the financial module to compute application costs';
