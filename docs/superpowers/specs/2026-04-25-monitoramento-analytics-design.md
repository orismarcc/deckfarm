# DeckFarm — Monitoramento de Pragas/Doenças + Analytics
**Data:** 2026-04-25  
**Status:** Aprovado

---

## 1. Escopo

Duas features independentes que compartilham dados:

1. **Monitoramento de Pragas/Doenças** — CRUD por talhão + visão consolidada por fazenda
2. **Analytics** — página global `/analytics` + aba resumida em `/fazendas/[id]`

---

## 2. Decisões de Arquitetura

| Decisão | Escolha |
|---------|---------|
| Catálogo de agentes | Lista estática no código, filtrada por cultura |
| Severidade | 5 níveis: nenhum / leve / moderado / severo / crítico |
| Fotos | base64, mesmo padrão de `Aplicacao` e `Talhao` |
| Sync | Dexie local + `syncQueue` → Supabase (offline-first) |
| Charts | Recharts |
| Analytics entry | `/analytics` global + aba compacta em fazenda |

---

## 3. Modelo de Dados

### 3.1 Novo tipo `MonitoramentoPraga`

```typescript
export type SeveridadeMonitoramento = 'nenhum' | 'leve' | 'moderado' | 'severo' | 'critico'
export type TipoAgente = 'praga' | 'doenca'

export interface MonitoramentoPraga {
  id: string
  talhao_id: string
  fazenda_id: string
  usuario_id: string
  tipo: TipoAgente
  agente: string              // chave do catálogo (ex: 'ferrugem_asiatica')
  severidade: SeveridadeMonitoramento
  data: string                // ISO date yyyy-MM-dd
  area_afetada?: number       // 0–100 (% do talhão)
  fotos?: string[]            // base64[]
  observacoes?: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}
```

### 3.2 Catálogo estático por cultura

```typescript
// src/lib/monitoramento/catalogo.ts
export const CATALOGO_AGENTES: Record<CulturaType, { pragas: Agente[]; doencas: Agente[] }> = {
  soja: {
    pragas: [
      { key: 'lagarta_soja',      label: 'Lagarta-da-soja' },
      { key: 'percevejo_marrom',  label: 'Percevejo-marrom' },
      { key: 'mosca_branca',      label: 'Mosca-branca' },
      { key: 'acaro_rajado',      label: 'Ácaro-rajado' },
      { key: 'lagarta_cartucho',  label: 'Lagarta-do-cartucho' },
    ],
    doencas: [
      { key: 'ferrugem_asiatica', label: 'Ferrugem Asiática' },
      { key: 'mancha_alvo',       label: 'Mancha-alvo' },
      { key: 'mofo_branco',       label: 'Mofo-branco' },
      { key: 'podridao_radicular',label: 'Podridão Radicular' },
    ],
  },
  milho: {
    pragas: [
      { key: 'lagarta_cartucho',  label: 'Lagarta-do-cartucho' },
      { key: 'lagarta_elasmo',    label: 'Lagarta-elasmo' },
      { key: 'cigarrinha',        label: 'Cigarrinha-do-milho' },
    ],
    doencas: [
      { key: 'ferrugem_polissora',label: 'Ferrugem Polissora' },
      { key: 'helmintosporiose',  label: 'Helmintosporiose' },
      { key: 'cercosporiose',     label: 'Cercosporiose' },
    ],
  },
  milho_safrinha: {
    pragas: [
      { key: 'lagarta_cartucho',  label: 'Lagarta-do-cartucho' },
      { key: 'cigarrinha',        label: 'Cigarrinha' },
    ],
    doencas: [
      { key: 'cercosporiose',     label: 'Cercosporiose' },
      { key: 'ferrugem_polissora',label: 'Ferrugem Polissora' },
    ],
  },
  algodao: {
    pragas: [
      { key: 'bicudo_algodoeiro', label: 'Bicudo-do-algodoeiro' },
      { key: 'mosca_branca',      label: 'Mosca-branca' },
      { key: 'pulgao',            label: 'Pulgão' },
    ],
    doencas: [
      { key: 'ramularia',         label: 'Ramulária' },
      { key: 'alternariose',      label: 'Alternariose' },
    ],
  },
  feijao: {
    pragas: [
      { key: 'cigarrinha_verde',  label: 'Cigarrinha-verde' },
      { key: 'mosca_branca',      label: 'Mosca-branca' },
    ],
    doencas: [
      { key: 'antracnose',        label: 'Antracnose' },
      { key: 'ferrugem_feijao',   label: 'Ferrugem' },
      { key: 'mancha_angular',    label: 'Mancha-angular' },
    ],
  },
  gergelim: {
    pragas: [],
    doencas: [
      { key: 'podridao_phytophthora', label: 'Podridão de Phytophthora' },
      { key: 'alternariose',          label: 'Alternariose' },
    ],
  },
}
```

### 3.3 Dexie — versão 8

```typescript
// Adicionar em todas as versões existentes + nova v8:
monitoramentos: 'id, talhao_id, fazenda_id, usuario_id, data, severidade, tipo'
```

### 3.4 Sync

- `SyncQueueItem.entity` ganha `'monitoramento'`
- Nova API route: `GET/POST /api/monitoramentos`
- `/api/sync/route.ts` `ALLOWED_FIELDS` ganha campos de `MonitoramentoPraga`

---

## 4. Feature: Monitoramento por Talhão

**Localização:** nova aba "Monitoramento" em `/talhoes/[id]`

### 4.1 Status badge no header do talhão
- Derivado do registro mais recente (ordenado por `data` desc)
- `nenhum/leve` → 🟢 verde | `moderado` → 🟡 amarelo | `severo/critico` → 🔴 vermelho
- Aparece no header mesmo quando em outras abas

### 4.2 Timeline / Lista
- Ordenada por `data` desc
- Card por registro: tipo + agente + severidade + área afetada + fotos + observações
- Botões: editar, excluir (soft-delete via `deletedAt`)
- Filtros:
  - Tipo: Todos / Pragas / Doenças
  - Severidade: checkboxes rápidos (multi-select)
  - Período: 7d / 30d / 90d / tudo

### 4.3 Modal criar/editar
Campos em ordem:
1. Tipo (toggle Praga / Doença)
2. Agente (select filtrado por tipo + cultura do talhão)
3. Severidade (5 botões visuais coloridos)
4. Data (date input, default: hoje)
5. Área afetada (slider 0–100%, opcional)
6. Fotos (PhotoPicker existente)
7. Observações (Textarea)

### 4.4 Inteligência inline
Após carregar registros, calcular:
```
mesmo agente, mesmos talhão, últimos 3 registros ordenados por data
→ se severidade[0] > severidade[1] > severidade[2]: mostrar banner amarelo
```
Mensagem: *"[Agente] com incidência crescente — avalie [fungicida/inseticida] para este talhão"*

---

## 5. Feature: Monitoramento por Fazenda

**Localização:** nova aba "Monitoramento" em `/fazendas/[id]`

### 5.1 Heatmap de talhões
Grid responsivo (3 cols desktop, 2 cols mobile). Um card por talhão:
- Cor de fundo = pior severidade atual do talhão
- Nome + agente crítico + count de registros
- Click → navega para `/talhoes/[id]?tab=monitoramento`

### 5.2 Agrupamento (toggle 3 modos)
- **Por talhão** (padrão): heatmap
- **Por praga/doença**: lista agrupada por agente, mostrando talhões afetados
- **Por severidade**: seções Crítico → Severo → Moderado → Leve → Nenhum

### 5.3 Lista consolidada
Todos os registros de todos os talhões da fazenda, mesmos filtros do nível talhão + filtro por talhão específico.

### 5.4 Alertas automáticos (banner no topo da aba)
- 🔴 **Novo surto**: agente não registrado nos últimos 30d aparece nos últimos 7d
- 📈 **Aumento de severidade**: `registros[-1].severidade > registros[-2].severidade` para mesmo agente/talhão

---

## 6. Feature: Analytics

### 6.1 Rota global `/analytics`

**Sidebar:** nova entrada após "Alertas" com ícone `BarChart3`, label "Analytics", sub "Relatórios".

**Filtros globais (sticky):**
- Fazenda (select)
- Talhão (select, filtrado pela fazenda)
- Cultura (select)
- Período: 7d / 30d / 90d / safra atual / personalizado

Estado dos filtros em Zustand (`useAnalyticsStore`).

### 6.2 KPI Cards

| # | Label | Cálculo |
|---|-------|---------|
| 1 | Total de aplicações | `count(aplicacoes)` no período/filtro |
| 2 | Atrasadas | `count where status='atrasado'` |
| 3 | Talhões críticos | `count talhoes` com monitoramento severo/crítico ativo |
| 4 | Custo total | `sum(dose × preco_unitario × area_aplicada)` |
| 5 | Índice de semeadura | `sum(area_semeada) / sum(area_total) × 100` |
| 6 | Área monitorada | talhões com ≥1 monitoramento nos últimos 30d |

### 6.3 Gráficos (Recharts)

**`TrendLineChart`** — Aplicações por semana/mês
- X: semanas ou meses do período
- Y: count de aplicações
- Múltiplas linhas: realizadas vs planejadas

**`ProductBarChart`** — Produtos mais usados
- X: nome do produto (top 10)
- Y: count de aplicações

**`TypePieChart`** — Distribuição por tipo de produto
- fatias: herbicida / fungicida / inseticida / fertilizante / defensivo

**`CropPieChart`** — Distribuição por cultura
- fatias: soja / milho / algodão / etc.

**`EventTimeline`** — Timeline de eventos da fazenda
- Lista cronológica: aplicações realizadas + monitoramentos críticos + semeaduras
- Ícone + cor por tipo de evento

### 6.4 Drill-down por talhão
Seção expansível (accordion) abaixo dos gráficos:
- Click em talhão → abre painel com:
  - Aplicações por produto (mini bar chart)
  - Monitoramento: severidade ao longo do tempo (mini line chart)
  - Custo/ha
  - Timeline individual

### 6.5 Aba compacta em `/fazendas/[id]`
- Aba "Analytics" após "Monitoramento"
- Apenas: 4 KPI cards + `TrendLineChart` + `TypePieChart`
- Botão "Ver analytics completo →" → `/analytics?fazenda=[id]`

---

## 7. Novos Componentes

### Monitoramento
| Componente | Arquivo | Responsabilidade |
|-----------|---------|-----------------|
| `SeveridadeBadge` | `ui/severidade-badge.tsx` | Badge colorido por nível |
| `MonitoramentoCard` | `monitoramento/monitoramento-card.tsx` | Card de um registro |
| `MonitoramentoModal` | `monitoramento/monitoramento-modal.tsx` | Form criar/editar |
| `MonitoramentoTimeline` | `monitoramento/monitoramento-timeline.tsx` | Lista filtrada |
| `MonitoramentoHeatmap` | `monitoramento/monitoramento-heatmap.tsx` | Grid de talhões |
| `MonitoramentoAlertas` | `monitoramento/monitoramento-alertas.tsx` | Banners de alerta |

### Analytics
| Componente | Arquivo | Responsabilidade |
|-----------|---------|-----------------|
| `AnalyticsFilters` | `analytics/analytics-filters.tsx` | Filtros globais sticky |
| `KpiCard` | `analytics/kpi-card.tsx` | Card de métrica com ícone/trend |
| `TrendLineChart` | `analytics/trend-line-chart.tsx` | Tendência de aplicações |
| `ProductBarChart` | `analytics/product-bar-chart.tsx` | Produtos mais usados |
| `TypePieChart` | `analytics/type-pie-chart.tsx` | Distribuição por tipo |
| `CropPieChart` | `analytics/crop-pie-chart.tsx` | Distribuição por cultura |
| `EventTimeline` | `analytics/event-timeline.tsx` | Timeline de eventos |
| `TalhaoAnalyticsDrilldown` | `analytics/talhao-drilldown.tsx` | Drill-down por talhão |

---

## 8. Novas Rotas e Modificações

### Novas rotas
- `src/app/(app)/analytics/page.tsx`
- `src/app/api/monitoramentos/route.ts`

### Arquivos modificados
- `src/types/index.ts` — novos tipos
- `src/lib/db/index.ts` — versão 8 + tabela `monitoramentos`
- `src/lib/db/sync.ts` — sync de monitoramentos
- `src/app/api/sync/route.ts` — ALLOWED_FIELDS monitoramento
- `src/app/(app)/talhoes/[id]/page.tsx` — aba Monitoramento
- `src/app/(app)/fazendas/[id]/page.tsx` — abas Monitoramento + Analytics
- `src/components/layout/sidebar.tsx` — entrada Analytics
- `src/components/layout/mobile-nav.tsx` — entrada Analytics
- `src/store/app.ts` — novo `useAnalyticsStore`

### Novo arquivo
- `src/lib/monitoramento/catalogo.ts` — catálogo estático de agentes
- `src/store/analytics.ts` — filtros globais de analytics

---

## 9. Performance e Índices

- Dexie: `monitoramentos` indexado por `talhao_id`, `fazenda_id`, `data`, `severidade`, `tipo`
- Queries de analytics: todas client-side via Dexie `.where().filter()` — sem servidor necessário
- Recharts: dados pré-agregados em `useMemo` antes de passar aos componentes
- Sem paginação por ora — dados de um único usuário em IndexedDB são manejáveis

---

## 10. Offline e Sync

- `MonitoramentoPraga` segue exatamente o padrão de `Aplicacao`:
  - Criado localmente → `_syncStatus: 'pending'`
  - Adicionado à `syncQueue` via `enqueueSync('monitoramento', 'upsert', data)`
  - Processado em background pelo `processSyncQueue`
- Analytics é 100% client-side (Dexie) — funciona offline sem adaptação

---

## 11. Fora do Escopo (para versões futuras)

- Correlação com dados de chuva (pluviômetro)
- Comparação histórica entre safras (estrutura pronta, UI não implementada)
- Exportação de relatórios de monitoramento para PDF
- Notificações push para surtos críticos
