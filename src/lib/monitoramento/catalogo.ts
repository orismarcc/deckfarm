import type { CulturaType } from '@/types'

export interface AgenteInfo {
  key: string
  label: string
}

export const CATALOGO_AGENTES: Record<CulturaType, { pragas: AgenteInfo[]; doencas: AgenteInfo[] }> = {
  soja: {
    pragas: [
      { key: 'lagarta_soja',     label: 'Lagarta-da-soja' },
      { key: 'percevejo_marrom', label: 'Percevejo-marrom' },
      { key: 'mosca_branca',     label: 'Mosca-branca' },
      { key: 'acaro_rajado',     label: 'Ácaro-rajado' },
      { key: 'lagarta_cartucho', label: 'Lagarta-do-cartucho' },
      { key: 'tripes',           label: 'Tripes' },
    ],
    doencas: [
      { key: 'ferrugem_asiatica',  label: 'Ferrugem Asiática' },
      { key: 'mancha_alvo',        label: 'Mancha-alvo' },
      { key: 'mofo_branco',        label: 'Mofo-branco' },
      { key: 'podridao_radicular', label: 'Podridão Radicular' },
      { key: 'oidio',              label: 'Oídio' },
    ],
  },
  milho: {
    pragas: [
      { key: 'lagarta_cartucho', label: 'Lagarta-do-cartucho' },
      { key: 'lagarta_elasmo',   label: 'Lagarta-elasmo' },
      { key: 'cigarrinha',       label: 'Cigarrinha-do-milho' },
      { key: 'pulgao_milho',     label: 'Pulgão-do-milho' },
    ],
    doencas: [
      { key: 'ferrugem_polissora', label: 'Ferrugem Polissora' },
      { key: 'helmintosporiose',   label: 'Helmintosporiose' },
      { key: 'cercosporiose',      label: 'Cercosporiose' },
      { key: 'grao_ardido',        label: 'Grão Ardido' },
    ],
  },
  milho_safrinha: {
    pragas: [
      { key: 'lagarta_cartucho', label: 'Lagarta-do-cartucho' },
      { key: 'cigarrinha',       label: 'Cigarrinha' },
    ],
    doencas: [
      { key: 'cercosporiose',      label: 'Cercosporiose' },
      { key: 'ferrugem_polissora', label: 'Ferrugem Polissora' },
    ],
  },
  algodao: {
    pragas: [
      { key: 'bicudo_algodoeiro', label: 'Bicudo-do-algodoeiro' },
      { key: 'mosca_branca',      label: 'Mosca-branca' },
      { key: 'pulgao',            label: 'Pulgão' },
      { key: 'curuquere',         label: 'Curuquerê' },
    ],
    doencas: [
      { key: 'ramularia',    label: 'Ramulária' },
      { key: 'alternariose', label: 'Alternariose' },
      { key: 'fusariose',    label: 'Fusariose' },
    ],
  },
  feijao: {
    pragas: [
      { key: 'cigarrinha_verde', label: 'Cigarrinha-verde' },
      { key: 'mosca_branca',     label: 'Mosca-branca' },
      { key: 'bruquinho',        label: 'Bruquinho' },
    ],
    doencas: [
      { key: 'antracnose',             label: 'Antracnose' },
      { key: 'ferrugem_feijao',        label: 'Ferrugem' },
      { key: 'mancha_angular',         label: 'Mancha-angular' },
      { key: 'crestamento_bacteriano', label: 'Crestamento Bacteriano' },
    ],
  },
  gergelim: {
    pragas: [
      { key: 'mosca_branca', label: 'Mosca-branca' },
    ],
    doencas: [
      { key: 'podridao_phytophthora', label: 'Podridão de Phytophthora' },
      { key: 'alternariose',          label: 'Alternariose' },
    ],
  },
}

export function getAgenteLabel(cultura: CulturaType, tipo: 'praga' | 'doenca', key: string): string {
  const lista = tipo === 'praga'
    ? CATALOGO_AGENTES[cultura]?.pragas
    : CATALOGO_AGENTES[cultura]?.doencas
  return lista?.find(a => a.key === key)?.label ?? key
}
