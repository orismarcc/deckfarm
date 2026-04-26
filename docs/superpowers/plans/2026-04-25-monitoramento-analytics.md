# Monitoramento de Pragas/Doenças + Analytics — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar monitoramento de pragas/doenças por talhão + fazenda, e página de analytics com gráficos Recharts, seguindo os padrões do DeckFarm (Dexie offline-first, Zustand, sync queue → Supabase).

**Architecture:** Dexie v8 adiciona tabela `monitoramentos` com índices por talhão/data/severidade. Componentes de monitoramento e analytics são separados em `src/components/monitoramento/` e `src/components/analytics/`. Analytics é 100% client-side (aggregações via Dexie + useMemo). Sync segue o padrão existente: enqueueSync → /api/sync → Supabase.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Dexie 4, Zustand, Recharts, Lucide React, date-fns.

---

## Mapa de Arquivos

### Criar
- `src/lib/monitoramento/catalogo.ts` — catálogo estático de pragas/doenças por cultura
- `src/store/analytics.ts` — Zustand store para filtros globais de analytics
- `src/app/api/monitoramentos/route.ts` — GET/POST endpoint (mesmo padrão dos outros)
- `src/components/ui/severidade-badge.tsx` — badge colorido por nível de severidade
- `src/components/monitoramento/monitoramento-card.tsx` — card de um registro
- `src/components/monitoramento/monitoramento-modal.tsx` — modal criar/editar
- `src/components/monitoramento/monitoramento-timeline.tsx` — lista filtrada
- `src/components/monitoramento/monitoramento-heatmap.tsx` — grid de talhões por severidade
- `src/components/monitoramento/monitoramento-alertas.tsx` — banners de alerta automático
- `src/components/analytics/kpi-card.tsx` — card de KPI com ícone + trend
- `src/components/analytics/analytics-filters.tsx` — filtros globais sticky
- `src/components/analytics/trend-line-chart.tsx` — Recharts LineChart de aplicações
- `src/components/analytics/product-bar-chart.tsx` — Recharts BarChart de produtos
- `src/components/analytics/type-pie-chart.tsx` — Recharts PieChart por tipo
- `src/components/analytics/crop-pie-chart.tsx` — Recharts PieChart por cultura
- `src/components/analytics/event-timeline.tsx` — timeline cronológica de eventos
- `src/components/analytics/talhao-drilldown.tsx` — accordion drill-down por talhão
- `src/app/(app)/analytics/page.tsx` — página de analytics global

### Modificar
- `src/types/index.ts` — adicionar MonitoramentoPraga, SeveridadeMonitoramento, TipoAgente
- `src/lib/db/index.ts` — versão 8 com tabela monitoramentos
- `src/lib/db/sync.ts` — adicionar monitoramento ao pull + ENTITY_TO_DEXIE
- `src/app/api/sync/route.ts` — adicionar monitoramento ao TABLE_MAP + ALLOWED_FIELDS
- `src/app/(app)/talhoes/[id]/page.tsx` — aba Monitoramento
- `src/app/(app)/fazendas/[id]/page.tsx` — abas Monitoramento + Analytics
- `src/components/layout/sidebar.tsx` — entrada Analytics
- `src/components/layout/mobile-nav.tsx` — entrada Analytics

---

## Task 1: Tipos + Catálogo + Dexie v8

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/monitoramento/catalogo.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **1.1 Adicionar tipos em `src/types/index.ts`**

Acrescentar após `export type SafraStatus`:

```typescript
export type SeveridadeMonitoramento = 'nenhum' | 'leve' | 'moderado' | 'severo' | 'critico'
export type TipoAgente = 'praga' | 'doenca'

export interface MonitoramentoPraga {
  id: string
  talhao_id: string
  fazenda_id: string
  usuario_id: string
  tipo: TipoAgente
  agente: string
  severidade: SeveridadeMonitoramento
  data: string
  area_afetada?: number
  fotos?: string[]
  observacoes?: string
  createdAt: string
  updatedAt: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}
```

Atualizar `SyncQueueItem.entity`:
```typescript
entity: 'fazenda' | 'talhao' | 'produto' | 'aplicacao' | 'semeadura_etapa' | 'estoqueMovimentacao' | 'monitoramento'
```

- [ ] **1.2 Criar `src/lib/monitoramento/catalogo.ts`**

```typescript
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
      { key: 'oídio',              label: 'Oídio' },
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
      { key: 'grão_ardido',        label: 'Grão Ardido' },
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
      { key: 'antracnose',    label: 'Antracnose' },
      { key: 'ferrugem_feijao', label: 'Ferrugem' },
      { key: 'mancha_angular', label: 'Mancha-angular' },
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
```

- [ ] **1.3 Adicionar versão 8 em `src/lib/db/index.ts`**

Importar o novo tipo:
```typescript
import type { ..., MonitoramentoPraga } from '@/types'
```

Adicionar table declaration na classe:
```typescript
monitoramentos!: Table<MonitoramentoPraga>
```

Adicionar no final do constructor (após `version(7)`):
```typescript
this.version(8).stores({
  users: 'id, email',
  fazendas: 'id, usuario_id, nome',
  talhoes: 'id, fazenda_id, nome, cultura, data_plantio, status_semeadura',
  produtos: 'id, fazenda_id, nome, tipo',
  aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo, deleted_at',
  notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
  syncQueue: 'id, entity, action, timestamp',
  safras: 'id, fazenda_id, status, ano_inicio',
  fazendaMembros: 'id, fazenda_id, usuario_id, status',
  pluviometros: 'id, fazenda_id, talhao_id',
  registrosChuva: 'id, pluviometro_id, fazenda_id, data',
  anotacoes: 'id, talhao_id, fazenda_id, usuario_id, data',
  recomendacoes: 'id, fazenda_id, usuario_id, data_inicio, data_fim',
  recomendacaoAplicacoes: 'id, recomendacao_id, talhao_id, produto_id, data_aplicacao',
  semeaduraEtapas: 'id, talhao_id, fazenda_id, usuario_id, etapa, data_semeadura',
  estoqueMovimentacoes: 'id, produto_id, fazenda_id, usuario_id, data',
  monitoramentos: 'id, talhao_id, fazenda_id, usuario_id, data, severidade, tipo',
})
```

- [ ] **1.4 Commit**
```
git add src/types/index.ts src/lib/monitoramento/catalogo.ts src/lib/db/index.ts
git commit -m "feat: tipos MonitoramentoPraga + catálogo + Dexie v8"
```

---

## Task 2: Store Analytics + Sync + API

**Files:**
- Create: `src/store/analytics.ts`
- Modify: `src/lib/db/sync.ts`
- Modify: `src/app/api/sync/route.ts`
- Create: `src/app/api/monitoramentos/route.ts`

- [ ] **2.1 Criar `src/store/analytics.ts`**

```typescript
import { create } from 'zustand'

export interface AnalyticsFilters {
  fazendaId: string | null
  talhaoId: string | null
  cultura: string | null
  periodo: '7d' | '30d' | '90d' | 'safra' | 'custom'
  dataInicio: string | null
  dataFim: string | null
}

interface AnalyticsState {
  filters: AnalyticsFilters
  setFilters: (f: Partial<AnalyticsFilters>) => void
  resetFilters: () => void
}

const DEFAULT: AnalyticsFilters = {
  fazendaId: null,
  talhaoId: null,
  cultura: null,
  periodo: '30d',
  dataInicio: null,
  dataFim: null,
}

export const useAnalyticsStore = create<AnalyticsState>()((set) => ({
  filters: DEFAULT,
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: DEFAULT }),
}))

/** Resolve dataInicio/dataFim for a given periodo */
export function resolvePeriodDates(filters: AnalyticsFilters): { from: string; to: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const to = fmt(today)
  if (filters.periodo === 'custom' && filters.dataInicio && filters.dataFim) {
    return { from: filters.dataInicio, to: filters.dataFim }
  }
  const days = filters.periodo === '7d' ? 7 : filters.periodo === '30d' ? 30 : 90
  const from = new Date(today)
  from.setDate(from.getDate() - days)
  return { from: fmt(from), to }
}
```

- [ ] **2.2 Atualizar `src/lib/db/sync.ts` — adicionar monitoramento**

No import de tipos, adicionar `MonitoramentoPraga`:
```typescript
import type { SyncQueueItem, Fazenda, Talhao, Produto, Aplicacao, SemeaduraEtapa, MonitoramentoPraga } from '@/types'
```

Em `ENTITY_TO_DEXIE`, adicionar:
```typescript
monitoramento: 'monitoramentos',
```

Em `pullFromServer`, adicionar `monitoramentos` ao `Promise.all`:
```typescript
const [fazendas, talhoes, produtos, aplicacoes, etapas, monitoramentos] = await Promise.all([
  fetchEntity<Record<string, unknown>>('/api/fazendas',        token, 'fazendas'),
  fetchEntity<Record<string, unknown>>('/api/talhoes',         token, 'talhoes'),
  fetchEntity<Record<string, unknown>>('/api/produtos',        token, 'produtos'),
  fetchEntity<Record<string, unknown>>('/api/aplicacoes',      token, 'aplicacoes'),
  fetchEntity<Record<string, unknown>>('/api/semeadura-etapas',token, 'semeadura_etapas'),
  fetchEntity<Record<string, unknown>>('/api/monitoramentos',  token, 'monitoramentos'),
])
```

Após os cleans existentes, adicionar:
```typescript
const cleanMonitoramentos = monitoramentos.map(stripJoins) as unknown as MonitoramentoPraga[]
if (cleanMonitoramentos.length) await db.monitoramentos.bulkPut(cleanMonitoramentos)
```

- [ ] **2.3 Atualizar `src/app/api/sync/route.ts`**

Em `TABLE_MAP`, adicionar:
```typescript
monitoramento: 'monitoramentos',
```

Em `ALLOWED_FIELDS`, adicionar:
```typescript
monitoramentos: new Set([
  'id', 'talhao_id', 'fazenda_id', 'usuario_id',
  'tipo', 'agente', 'severidade', 'data',
  'area_afetada', 'fotos', 'observacoes',
  'createdAt', 'updatedAt',
]),
```

- [ ] **2.4 Criar `src/app/api/monitoramentos/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/security/logger'

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('monitoramentos')
      .select('*')
      .eq('usuario_id', payload.userId)
      .order('data', { ascending: false })

    if (error) {
      logger.error('GET /api/monitoramentos', { error: error.message })
      return NextResponse.json({ error: 'Erro ao buscar monitoramentos' }, { status: 500 })
    }

    return NextResponse.json({ monitoramentos: data ?? [] })
  } catch (err) {
    logger.error('GET /api/monitoramentos exception', { err })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  try {
    const body = await req.json()
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('monitoramentos')
      .upsert({ ...body, usuario_id: payload.userId })
      .select()
      .single()

    if (error) {
      logger.error('POST /api/monitoramentos', { error: error.message })
      return NextResponse.json({ error: 'Erro ao salvar monitoramento' }, { status: 500 })
    }

    return NextResponse.json({ monitoramento: data })
  } catch (err) {
    logger.error('POST /api/monitoramentos exception', { err })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **2.5 Commit**
```
git add src/store/analytics.ts src/lib/db/sync.ts src/app/api/sync/route.ts src/app/api/monitoramentos/route.ts
git commit -m "feat: store analytics + sync monitoramento + API route"
```

---

## Task 3: Componentes UI — Severidade + Card + Modal

**Files:**
- Create: `src/components/ui/severidade-badge.tsx`
- Create: `src/components/monitoramento/monitoramento-card.tsx`
- Create: `src/components/monitoramento/monitoramento-modal.tsx`

- [ ] **3.1 Criar `src/components/ui/severidade-badge.tsx`**

```typescript
import type { SeveridadeMonitoramento } from '@/types'

const CFG: Record<SeveridadeMonitoramento, { label: string; color: string; bg: string; dot: string }> = {
  nenhum:   { label: 'Nenhum',   color: '#6b7280', bg: '#f3f4f6', dot: '#6b7280' },
  leve:     { label: 'Leve',     color: '#16a34a', bg: '#dcfce7', dot: '#16a34a' },
  moderado: { label: 'Moderado', color: '#d97706', bg: '#fef3c7', dot: '#d97706' },
  severo:   { label: 'Severo',   color: '#dc2626', bg: '#fee2e2', dot: '#dc2626' },
  critico:  { label: 'Crítico',  color: '#7c3aed', bg: '#ede9fe', dot: '#7c3aed' },
}

export function SeveridadeBadge({
  severidade,
  size = 'sm',
}: {
  severidade: SeveridadeMonitoramento
  size?: 'xs' | 'sm' | 'md'
}) {
  const cfg = CFG[severidade] ?? CFG.nenhum
  const fontSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 12
  const padding = size === 'xs' ? '1px 6px' : size === 'sm' ? '2px 8px' : '3px 10px'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize, fontWeight: 700, padding,
      borderRadius: 999, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

export function severidadeColor(s: SeveridadeMonitoramento): string {
  return CFG[s]?.dot ?? '#6b7280'
}

export function severidadeBg(s: SeveridadeMonitoramento): string {
  return CFG[s]?.bg ?? '#f3f4f6'
}

export const SEVERIDADE_ORDER: SeveridadeMonitoramento[] = ['nenhum', 'leve', 'moderado', 'severo', 'critico']

export function worstSeveridade(severidades: SeveridadeMonitoramento[]): SeveridadeMonitoramento {
  if (!severidades.length) return 'nenhum'
  return severidades.reduce((worst, s) => {
    return SEVERIDADE_ORDER.indexOf(s) > SEVERIDADE_ORDER.indexOf(worst) ? s : worst
  }, 'nenhum' as SeveridadeMonitoramento)
}
```

- [ ] **3.2 Criar `src/components/monitoramento/monitoramento-card.tsx`**

```typescript
'use client'
import { Trash2, Pencil, Bug, Leaf, Camera } from 'lucide-react'
import type { MonitoramentoPraga, CulturaType } from '@/types'
import { SeveridadeBadge } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState } from 'react'

interface MonitoramentoCardProps {
  registro: MonitoramentoPraga
  cultura: CulturaType
  onEdit: (r: MonitoramentoPraga) => void
  onDelete: (id: string) => void
}

export function MonitoramentoCard({ registro, cultura, onEdit, onDelete }: MonitoramentoCardProps) {
  const [showPhotos, setShowPhotos] = useState(false)
  const label = getAgenteLabel(cultura, registro.tipo, registro.agente)
  const dataFmt = (() => {
    try { return format(parseISO(registro.data), "d 'de' MMM yyyy", { locale: ptBR }) }
    catch { return registro.data }
  })()

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: registro.tipo === 'praga' ? '#fef3c7' : '#ede9fe' }}>
            {registro.tipo === 'praga'
              ? <Bug size={15} style={{ color: '#d97706' }} />
              : <Leaf size={15} style={{ color: '#7c3aed' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--fg)' }}>{label}</p>
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              {registro.tipo === 'praga' ? 'Praga' : 'Doença'} · {dataFmt}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SeveridadeBadge severidade={registro.severidade} />
          <button onClick={() => onEdit(registro)} className="p-1.5 rounded-lg transition hover:bg-black/5">
            <Pencil size={13} style={{ color: 'var(--fg-subtle)' }} />
          </button>
          <button onClick={() => onDelete(registro.id)} className="p-1.5 rounded-lg transition hover:bg-red-50">
            <Trash2 size={13} style={{ color: '#dc2626' }} />
          </button>
        </div>
      </div>

      {registro.area_afetada != null && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Área afetada:</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${registro.area_afetada}%`, background: '#dc2626' }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>{registro.area_afetada}%</span>
        </div>
      )}

      {registro.observacoes && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-subtle)' }}>{registro.observacoes}</p>
      )}

      {registro.fotos && registro.fotos.length > 0 && (
        <div>
          <button
            onClick={() => setShowPhotos(v => !v)}
            className="flex items-center gap-1 text-xs font-medium transition"
            style={{ color: 'var(--verde-700)' }}
          >
            <Camera size={12} /> {registro.fotos.length} foto{registro.fotos.length > 1 ? 's' : ''}
          </button>
          {showPhotos && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {registro.fotos.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={f} alt={`foto ${i+1}`}
                  className="w-16 h-16 object-cover rounded-lg border"
                  style={{ borderColor: 'var(--borda)' }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **3.3 Criar `src/components/monitoramento/monitoramento-modal.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { PhotoPicker } from '@/components/ui/photo-picker'
import type { MonitoramentoPraga, CulturaType, SeveridadeMonitoramento, TipoAgente } from '@/types'
import { CATALOGO_AGENTES } from '@/lib/monitoramento/catalogo'
import { format } from 'date-fns'

const SEVERIDADES: { value: SeveridadeMonitoramento; label: string; color: string }[] = [
  { value: 'nenhum',   label: 'Nenhum',   color: '#6b7280' },
  { value: 'leve',     label: 'Leve',     color: '#16a34a' },
  { value: 'moderado', label: 'Moderado', color: '#d97706' },
  { value: 'severo',   label: 'Severo',   color: '#dc2626' },
  { value: 'critico',  label: 'Crítico',  color: '#7c3aed' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<MonitoramentoPraga, 'id' | 'createdAt' | 'updatedAt' | '_syncStatus'>) => void
  editing?: MonitoramentoPraga | null
  talhaoId: string
  fazendaId: string
  usuarioId: string
  cultura: CulturaType
}

const TODAY = format(new Date(), 'yyyy-MM-dd')

export function MonitoramentoModal({ open, onClose, onSave, editing, talhaoId, fazendaId, usuarioId, cultura }: Props) {
  const [tipo, setTipo] = useState<TipoAgente>('praga')
  const [agente, setAgente] = useState('')
  const [severidade, setSeveridade] = useState<SeveridadeMonitoramento>('leve')
  const [data, setData] = useState(TODAY)
  const [areaAfetada, setAreaAfetada] = useState<number | ''>('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState<string[]>([])

  useEffect(() => {
    if (editing) {
      setTipo(editing.tipo)
      setAgente(editing.agente)
      setSeveridade(editing.severidade)
      setData(editing.data)
      setAreaAfetada(editing.area_afetada ?? '')
      setObservacoes(editing.observacoes ?? '')
      setFotos(editing.fotos ?? [])
    } else {
      setTipo('praga'); setAgente(''); setSeveridade('leve')
      setData(TODAY); setAreaAfetada(''); setObservacoes(''); setFotos([])
    }
  }, [editing, open])

  const agentes = tipo === 'praga' ? CATALOGO_AGENTES[cultura]?.pragas ?? [] : CATALOGO_AGENTES[cultura]?.doencas ?? []

  function handleSave() {
    if (!agente) return
    onSave({
      talhao_id: talhaoId,
      fazenda_id: fazendaId,
      usuario_id: usuarioId,
      tipo,
      agente,
      severidade,
      data,
      area_afetada: areaAfetada === '' ? undefined : Number(areaAfetada),
      observacoes: observacoes || undefined,
      fotos: fotos.length ? fotos : undefined,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar monitoramento' : 'Novo monitoramento'}>
      <div className="flex flex-col gap-4 p-4">
        {/* Tipo */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--fg-subtle)' }}>TIPO</label>
          <div className="flex gap-2">
            {(['praga', 'doenca'] as TipoAgente[]).map(t => (
              <button key={t} onClick={() => { setTipo(t); setAgente('') }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: tipo === t ? (t === 'praga' ? '#fef3c7' : '#ede9fe') : 'var(--bg-dark)',
                  color: tipo === t ? (t === 'praga' ? '#d97706' : '#7c3aed') : 'var(--fg-subtle)',
                  border: `1px solid ${tipo === t ? (t === 'praga' ? '#d97706' : '#7c3aed') : 'var(--borda)'}`,
                }}>
                {t === 'praga' ? '🐛 Praga' : '🍄 Doença'}
              </button>
            ))}
          </div>
        </div>

        {/* Agente */}
        <Select
          label="AGENTE"
          value={agente}
          onChange={e => setAgente(e.target.value)}
        >
          <option value="">Selecione...</option>
          {agentes.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
        </Select>

        {/* Severidade */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--fg-subtle)' }}>SEVERIDADE</label>
          <div className="flex gap-1.5 flex-wrap">
            {SEVERIDADES.map(s => (
              <button key={s.value} onClick={() => setSeveridade(s.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                style={{
                  background: severidade === s.value ? s.color : 'var(--bg-dark)',
                  color: severidade === s.value ? '#fff' : 'var(--fg-subtle)',
                  border: `1px solid ${severidade === s.value ? s.color : 'var(--borda)'}`,
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data */}
        <Input label="DATA" type="date" value={data} onChange={e => setData(e.target.value)} />

        {/* Área afetada */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--fg-subtle)' }}>
            ÁREA AFETADA: {areaAfetada !== '' ? `${areaAfetada}%` : 'não informado'}
          </label>
          <input type="range" min={0} max={100} value={areaAfetada === '' ? 0 : areaAfetada}
            onChange={e => setAreaAfetada(Number(e.target.value))}
            className="w-full accent-red-500" />
        </div>

        {/* Fotos */}
        <PhotoPicker label="FOTOS" value={fotos} onChange={setFotos} multiple />

        {/* Observações */}
        <Textarea label="OBSERVAÇÕES" value={observacoes} onChange={e => setObservacoes(e.target.value)}
          placeholder="Descreva o nível de infestação, localização no talhão..." rows={3} />

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} disabled={!agente} className="flex-1">
            {editing ? 'Salvar alterações' : 'Registrar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **3.4 Commit**
```
git add src/components/ui/severidade-badge.tsx src/components/monitoramento/monitoramento-card.tsx src/components/monitoramento/monitoramento-modal.tsx
git commit -m "feat: SeveridadeBadge + MonitoramentoCard + MonitoramentoModal"
```

---

## Task 4: Componentes de Monitoramento — Timeline + Heatmap + Alertas

**Files:**
- Create: `src/components/monitoramento/monitoramento-timeline.tsx`
- Create: `src/components/monitoramento/monitoramento-heatmap.tsx`
- Create: `src/components/monitoramento/monitoramento-alertas.tsx`

- [ ] **4.1 Criar `src/components/monitoramento/monitoramento-timeline.tsx`**

```typescript
'use client'
import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import type { MonitoramentoPraga, CulturaType, SeveridadeMonitoramento } from '@/types'
import { MonitoramentoCard } from './monitoramento-card'
import { Button } from '@/components/ui/button'

type PeriodoFilter = '7d' | '30d' | '90d' | 'all'
type TipoFilter = 'all' | 'praga' | 'doenca'

interface Props {
  registros: MonitoramentoPraga[]
  cultura: CulturaType
  onNew: () => void
  onEdit: (r: MonitoramentoPraga) => void
  onDelete: (id: string) => void
}

const SEVERIDADES: SeveridadeMonitoramento[] = ['nenhum', 'leve', 'moderado', 'severo', 'critico']

export function MonitoramentoTimeline({ registros, cultura, onNew, onEdit, onDelete }: Props) {
  const [tipo, setTipo] = useState<TipoFilter>('all')
  const [periodo, setPeriodo] = useState<PeriodoFilter>('30d')
  const [severidadeFilter, setSeveridadeFilter] = useState<Set<SeveridadeMonitoramento>>(new Set())

  const filtered = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now)
    if (periodo !== 'all') cutoff.setDate(cutoff.getDate() - (periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90))

    return registros
      .filter(r => tipo === 'all' || r.tipo === tipo)
      .filter(r => periodo === 'all' || r.data >= cutoff.toISOString().slice(0, 10))
      .filter(r => severidadeFilter.size === 0 || severidadeFilter.has(r.severidade))
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [registros, tipo, periodo, severidadeFilter])

  function toggleSev(s: SeveridadeMonitoramento) {
    setSeveridadeFilter(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const btnBase: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
    border: '1px solid var(--borda)', cursor: 'pointer', transition: 'all .15s',
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {(['all', 'praga', 'doenca'] as TipoFilter[]).map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{
              ...btnBase,
              background: tipo === t ? 'var(--verde-700)' : 'var(--bg-dark)',
              color: tipo === t ? '#fff' : 'var(--fg-subtle)',
              borderColor: tipo === t ? 'var(--verde-700)' : 'var(--borda)',
            }}>
              {t === 'all' ? 'Todos' : t === 'praga' ? '🐛 Pragas' : '🍄 Doenças'}
            </button>
          ))}
        </div>
        <Button onClick={onNew} style={{ fontSize: 12, padding: '6px 14px' }}>
          <Plus size={13} /> Registrar
        </Button>
      </div>

      {/* Período */}
      <div className="flex gap-1 flex-wrap">
        {(['7d', '30d', '90d', 'all'] as PeriodoFilter[]).map(p => (
          <button key={p} onClick={() => setPeriodo(p)} style={{
            ...btnBase,
            background: periodo === p ? 'var(--bg-dark)' : 'transparent',
            color: periodo === p ? 'var(--fg)' : 'var(--fg-subtle)',
          }}>
            {p === 'all' ? 'Tudo' : p}
          </button>
        ))}
      </div>

      {/* Severidade filter */}
      <div className="flex gap-1 flex-wrap items-center">
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Severidade:</span>
        {SEVERIDADES.map(s => (
          <button key={s} onClick={() => toggleSev(s)} style={{
            ...btnBase, fontSize: 10,
            background: severidadeFilter.has(s) ? 'var(--fg)' : 'var(--bg-dark)',
            color: severidadeFilter.has(s) ? 'var(--bg)' : 'var(--fg-subtle)',
          }}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--fg-subtle)' }}>
          <p className="text-sm">Nenhum registro encontrado</p>
          <p className="text-xs mt-1">Clique em "Registrar" para adicionar o primeiro monitoramento</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(r => (
            <MonitoramentoCard key={r.id} registro={r} cultura={cultura} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **4.2 Criar `src/components/monitoramento/monitoramento-heatmap.tsx`**

```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { MonitoramentoPraga, Talhao, CulturaType } from '@/types'
import { SeveridadeBadge, worstSeveridade, severidadeBg, severidadeColor, SEVERIDADE_ORDER } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'
import type { SeveridadeMonitoramento } from '@/types'

type GroupMode = 'talhao' | 'agente' | 'severidade'

interface TalhaoComMonitoramento {
  talhao: Talhao
  registros: MonitoramentoPraga[]
}

interface Props {
  dados: TalhaoComMonitoramento[]
}

export function MonitoramentoHeatmap({ dados }: Props) {
  const [groupMode, setGroupMode] = useState<GroupMode>('talhao')

  const btnBase: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
    border: '1px solid var(--borda)', cursor: 'pointer',
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group toggle */}
      <div className="flex gap-1">
        {(['talhao', 'agente', 'severidade'] as GroupMode[]).map(m => (
          <button key={m} onClick={() => setGroupMode(m)} style={{
            ...btnBase,
            background: groupMode === m ? 'var(--verde-700)' : 'var(--bg-dark)',
            color: groupMode === m ? '#fff' : 'var(--fg-subtle)',
            borderColor: groupMode === m ? 'var(--verde-700)' : 'var(--borda)',
          }}>
            {m === 'talhao' ? 'Por talhão' : m === 'agente' ? 'Por agente' : 'Por severidade'}
          </button>
        ))}
      </div>

      {groupMode === 'talhao' && <HeatmapByTalhao dados={dados} />}
      {groupMode === 'agente' && <HeatmapByAgente dados={dados} />}
      {groupMode === 'severidade' && <HeatmapBySeveridade dados={dados} />}
    </div>
  )
}

function HeatmapByTalhao({ dados }: { dados: TalhaoComMonitoramento[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {dados.map(({ talhao, registros }) => {
        const worst = worstSeveridade(registros.map(r => r.severidade))
        const recente = registros.sort((a, b) => b.data.localeCompare(a.data))[0]
        return (
          <Link key={talhao.id} href={`/talhoes/${talhao.id}?tab=monitoramento`}
            className="p-3 rounded-xl border transition hover:shadow-md flex flex-col gap-2"
            style={{ borderColor: `${severidadeColor(worst)}44`, background: `${severidadeBg(worst)}` }}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{talhao.nome}</span>
              <SeveridadeBadge severidade={worst} size="xs" />
            </div>
            {recente ? (
              <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                {getAgenteLabel(talhao.cultura, recente.tipo, recente.agente)}
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Sem registros</p>
            )}
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{registros.length} registro{registros.length !== 1 ? 's' : ''}</p>
          </Link>
        )
      })}
    </div>
  )
}

function HeatmapByAgente({ dados }: { dados: TalhaoComMonitoramento[] }) {
  const byAgente = new Map<string, { label: string; items: Array<{ talhao: Talhao; registro: MonitoramentoPraga }> }>()
  for (const { talhao, registros } of dados) {
    for (const r of registros) {
      const key = r.agente
      if (!byAgente.has(key)) byAgente.set(key, { label: getAgenteLabel(talhao.cultura as CulturaType, r.tipo, r.agente), items: [] })
      byAgente.get(key)!.items.push({ talhao, registro: r })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byAgente.entries()).map(([key, { label, items }]) => (
        <div key={key}>
          <p className="font-semibold text-sm mb-2" style={{ color: 'var(--fg)' }}>{label}</p>
          <div className="flex flex-wrap gap-2">
            {items.map(({ talhao, registro }) => (
              <Link key={`${talhao.id}-${registro.id}`} href={`/talhoes/${talhao.id}?tab=monitoramento`}
                className="px-2 py-1 rounded-lg text-xs font-medium border transition hover:shadow-sm"
                style={{ borderColor: `${severidadeColor(registro.severidade)}44`, background: severidadeBg(registro.severidade), color: 'var(--fg)' }}>
                {talhao.nome} · <SeveridadeBadge severidade={registro.severidade} size="xs" />
              </Link>
            ))}
          </div>
        </div>
      ))}
      {byAgente.size === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--fg-subtle)' }}>Nenhum registro encontrado</p>}
    </div>
  )
}

function HeatmapBySeveridade({ dados }: { dados: TalhaoComMonitoramento[] }) {
  const bySev = new Map<SeveridadeMonitoramento, Array<{ talhao: Talhao; registro: MonitoramentoPraga }>>()
  for (const s of SEVERIDADE_ORDER) bySev.set(s, [])
  for (const { talhao, registros } of dados) {
    for (const r of registros) {
      bySev.get(r.severidade)?.push({ talhao, registro: r })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {[...SEVERIDADE_ORDER].reverse().map(sev => {
        const items = bySev.get(sev) ?? []
        if (!items.length) return null
        return (
          <div key={sev}>
            <div className="flex items-center gap-2 mb-2">
              <SeveridadeBadge severidade={sev} />
              <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{items.length} ocorrência{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map(({ talhao, registro }) => (
                <Link key={`${talhao.id}-${registro.id}`} href={`/talhoes/${talhao.id}?tab=monitoramento`}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--borda)', background: 'var(--bg-card)', color: 'var(--fg)' }}>
                  {talhao.nome} · {getAgenteLabel(talhao.cultura as CulturaType, registro.tipo, registro.agente)}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **4.3 Criar `src/components/monitoramento/monitoramento-alertas.tsx`**

```typescript
'use client'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { MonitoramentoPraga, CulturaType } from '@/types'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'
import { SEVERIDADE_ORDER } from '@/components/ui/severidade-badge'
import type { SeveridadeMonitoramento } from '@/types'
import { subDays, parseISO } from 'date-fns'

interface Props {
  registros: MonitoramentoPraga[]
  talhoes: Array<{ id: string; nome: string; cultura: CulturaType }>
}

interface Alerta {
  tipo: 'surto' | 'aumento'
  talhaoNome: string
  talhaoId: string
  agenteLabel: string
  mensagem: string
}

export function MonitoramentoAlertas({ registros, talhoes }: Props) {
  const alertas: Alerta[] = []

  const talhaoMap = new Map(talhoes.map(t => [t.id, t]))
  const hoje = new Date()
  const limite7d = subDays(hoje, 7).toISOString().slice(0, 10)
  const limite30d = subDays(hoje, 30).toISOString().slice(0, 10)

  // Group by talhao+agente
  const byKey = new Map<string, MonitoramentoPraga[]>()
  for (const r of registros) {
    const key = `${r.talhao_id}::${r.agente}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(r)
  }

  for (const [key, recs] of byKey.entries()) {
    const sorted = [...recs].sort((a, b) => a.data.localeCompare(b.data))
    const [talhaoId] = key.split('::')
    const talhao = talhaoMap.get(talhaoId)
    if (!talhao) continue
    const label = getAgenteLabel(talhao.cultura, sorted[0].tipo, sorted[0].agente)

    // Novo surto: primeiros registros nos últimos 7d, mas nenhum nos 30d anteriores
    const recentesLast7 = sorted.filter(r => r.data >= limite7d)
    const anteriores = sorted.filter(r => r.data < limite7d && r.data >= limite30d)
    if (recentesLast7.length > 0 && anteriores.length === 0 && sorted.length <= recentesLast7.length) {
      alertas.push({
        tipo: 'surto',
        talhaoNome: talhao.nome,
        talhaoId,
        agenteLabel: label,
        mensagem: `Novo surto de ${label} detectado em ${talhao.nome}`,
      })
    }

    // Aumento de severidade: últimos 2 registros mostram piora
    if (sorted.length >= 2) {
      const last = sorted[sorted.length - 1]
      const prev = sorted[sorted.length - 2]
      const iLast = SEVERIDADE_ORDER.indexOf(last.severidade as SeveridadeMonitoramento)
      const iPrev = SEVERIDADE_ORDER.indexOf(prev.severidade as SeveridadeMonitoramento)
      if (iLast > iPrev) {
        alertas.push({
          tipo: 'aumento',
          talhaoNome: talhao.nome,
          talhaoId,
          agenteLabel: label,
          mensagem: `${label} em ${talhao.nome}: severidade aumentou para ${last.severidade}`,
        })
      }
    }
  }

  if (!alertas.length) return null

  return (
    <div className="flex flex-col gap-2 mb-4">
      {alertas.map((a, i) => (
        <div key={i} className="flex items-start gap-2 p-3 rounded-xl"
          style={{
            background: a.tipo === 'surto' ? '#fee2e2' : '#fef3c7',
            border: `1px solid ${a.tipo === 'surto' ? '#fca5a5' : '#fcd34d'}`,
          }}>
          {a.tipo === 'surto'
            ? <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
            : <TrendingUp size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />}
          <span className="text-xs font-medium" style={{ color: a.tipo === 'surto' ? '#7f1d1d' : '#78350f' }}>
            {a.mensagem}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **4.4 Commit**
```
git add src/components/monitoramento/
git commit -m "feat: MonitoramentoTimeline + MonitoramentoHeatmap + MonitoramentoAlertas"
```

---

## Task 5: Componentes Analytics

**Files:**
- Create: `src/components/analytics/kpi-card.tsx`
- Create: `src/components/analytics/analytics-filters.tsx`
- Create: `src/components/analytics/trend-line-chart.tsx`
- Create: `src/components/analytics/product-bar-chart.tsx`
- Create: `src/components/analytics/type-pie-chart.tsx`
- Create: `src/components/analytics/crop-pie-chart.tsx`
- Create: `src/components/analytics/event-timeline.tsx`
- Create: `src/components/analytics/talhao-drilldown.tsx`

- [ ] **5.1 Criar `src/components/analytics/kpi-card.tsx`**

```typescript
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  color?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function KpiCard({ label, value, sub, icon: Icon, color = 'var(--verde-700)', trend, trendValue }: KpiCardProps) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{sub}</p>}
      </div>
      {trend && trendValue && (
        <p className="text-xs font-medium" style={{ color: trend === 'up' ? '#dc2626' : trend === 'down' ? '#16a34a' : 'var(--fg-subtle)' }}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </p>
      )}
    </div>
  )
}
```

- [ ] **5.2 Criar `src/components/analytics/analytics-filters.tsx`**

```typescript
'use client'
import { useAnalyticsStore } from '@/store/analytics'
import type { Fazenda, Talhao } from '@/types'
import { culturaLabel } from '@/lib/utils'

const PERIODOS = [
  { value: '7d',   label: '7 dias'  },
  { value: '30d',  label: '30 dias' },
  { value: '90d',  label: '90 dias' },
  { value: 'safra', label: 'Safra atual' },
] as const

interface Props {
  fazendas: Fazenda[]
  talhoes: Talhao[]
}

export function AnalyticsFilters({ fazendas, talhoes }: Props) {
  const { filters, setFilters } = useAnalyticsStore()

  const talhoesFiltered = filters.fazendaId
    ? talhoes.filter(t => t.fazenda_id === filters.fazendaId)
    : talhoes

  const culturas = [...new Set(talhoes.map(t => t.cultura))]

  const selStyle: React.CSSProperties = {
    fontSize: 12, padding: '6px 10px', borderRadius: 8,
    border: '1px solid var(--borda)', background: 'var(--bg-card)',
    color: 'var(--fg)', outline: 'none',
  }

  return (
    <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl mb-4"
      style={{ background: 'var(--bg-dark)', border: '1px solid var(--borda)' }}>
      <span className="text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>Filtros:</span>

      <select style={selStyle} value={filters.fazendaId ?? ''} onChange={e => setFilters({ fazendaId: e.target.value || null, talhaoId: null })}>
        <option value="">Todas as fazendas</option>
        {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>

      <select style={selStyle} value={filters.talhaoId ?? ''} onChange={e => setFilters({ talhaoId: e.target.value || null })}>
        <option value="">Todos os talhões</option>
        {talhoesFiltered.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      <select style={selStyle} value={filters.cultura ?? ''} onChange={e => setFilters({ cultura: e.target.value || null })}>
        <option value="">Todas as culturas</option>
        {culturas.map(c => <option key={c} value={c}>{culturaLabel(c)}</option>)}
      </select>

      <div className="flex gap-1">
        {PERIODOS.map(p => (
          <button key={p.value} onClick={() => setFilters({ periodo: p.value })}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
            style={{
              background: filters.periodo === p.value ? 'var(--verde-700)' : 'transparent',
              color: filters.periodo === p.value ? '#fff' : 'var(--fg-subtle)',
            }}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **5.3 Criar `src/components/analytics/trend-line-chart.tsx`**

```typescript
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface TrendDataPoint {
  label: string
  realizadas: number
  planejadas: number
}

interface Props {
  data: TrendDataPoint[]
  height?: number
}

export function TrendLineChart({ data, height = 240 }: Props) {
  if (!data.length) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Sem dados no período</p>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--borda)', background: 'var(--bg-card)', color: 'var(--fg)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="realizadas" name="Realizadas" stroke="#16a34a" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="planejadas" name="Planejadas" stroke="#d97706" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **5.4 Criar `src/components/analytics/product-bar-chart.tsx`**

```typescript
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ProductDataPoint {
  nome: string
  quantidade: number
}

interface Props {
  data: ProductDataPoint[]
  height?: number
}

export function ProductBarChart({ data, height = 240 }: Props) {
  const top10 = [...data].sort((a, b) => b.quantidade - a.quantidade).slice(0, 10)
  if (!top10.length) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Sem dados</p>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={top10} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
        <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--borda)', background: 'var(--bg-card)', color: 'var(--fg)' }} />
        <Bar dataKey="quantidade" name="Aplicações" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **5.5 Criar `src/components/analytics/type-pie-chart.tsx`**

```typescript
'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  data: Array<{ name: string; value: number; color: string }>
  height?: number
}

export function TypePieChart({ data, height = 240 }: Props) {
  const nonEmpty = data.filter(d => d.value > 0)
  if (!nonEmpty.length) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Sem dados</p>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={nonEmpty} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
          {nonEmpty.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--borda)', background: 'var(--bg-card)', color: 'var(--fg)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **5.6 Criar `src/components/analytics/crop-pie-chart.tsx`**

```typescript
'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { culturaLabel } from '@/lib/utils'
import type { CulturaType } from '@/types'

const CROP_COLORS: Record<string, string> = {
  soja: '#16a34a', milho: '#d97706', milho_safrinha: '#f59e0b',
  algodao: '#6366f1', feijao: '#ef4444', gergelim: '#8b5cf6',
}

interface Props {
  data: Array<{ cultura: CulturaType; count: number }>
  height?: number
}

export function CropPieChart({ data, height = 240 }: Props) {
  const chartData = data.filter(d => d.count > 0).map(d => ({
    name: culturaLabel(d.cultura),
    value: d.count,
    color: CROP_COLORS[d.cultura] ?? '#6b7280',
  }))
  if (!chartData.length) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Sem dados</p>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
          {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--borda)', background: 'var(--bg-card)', color: 'var(--fg)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **5.7 Criar `src/components/analytics/event-timeline.tsx`**

```typescript
'use client'
import { FlaskConical, Bug, Sprout } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface TimelineEvent {
  id: string
  tipo: 'aplicacao' | 'monitoramento' | 'semeadura'
  data: string
  descricao: string
  talhaoNome?: string
  severity?: 'normal' | 'alert'
}

const TIPO_CFG = {
  aplicacao:     { icon: FlaskConical, color: '#16a34a', bg: '#dcfce7', label: 'Aplicação' },
  monitoramento: { icon: Bug,          color: '#dc2626', bg: '#fee2e2', label: 'Monitoramento' },
  semeadura:     { icon: Sprout,       color: '#d97706', bg: '#fef3c7', label: 'Semeadura' },
}

interface Props {
  events: TimelineEvent[]
  maxItems?: number
}

export function EventTimeline({ events, maxItems = 20 }: Props) {
  const sorted = [...events].sort((a, b) => b.data.localeCompare(a.data)).slice(0, maxItems)

  if (!sorted.length) return (
    <p className="text-sm text-center py-4" style={{ color: 'var(--fg-subtle)' }}>Nenhum evento no período</p>
  )

  return (
    <div className="flex flex-col">
      {sorted.map((ev, i) => {
        const cfg = TIPO_CFG[ev.tipo]
        const Icon = cfg.icon
        const dateFmt = (() => {
          try { return format(parseISO(ev.data), "d MMM", { locale: ptBR }) }
          catch { return ev.data }
        })()
        return (
          <div key={ev.id} className="flex gap-3 relative">
            {/* Timeline line */}
            {i < sorted.length - 1 && (
              <div className="absolute left-4 top-8 bottom-0 w-px" style={{ background: 'var(--borda)' }} />
            )}
            {/* Icon */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
              style={{ background: cfg.bg }}>
              <Icon size={14} style={{ color: cfg.color }} />
            </div>
            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                {ev.talhaoNome && <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>· {ev.talhaoNome}</span>}
                <span className="text-xs ml-auto" style={{ color: 'var(--fg-subtle)' }}>{dateFmt}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg)' }}>{ev.descricao}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **5.8 Criar `src/components/analytics/talhao-drilldown.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Talhao, Aplicacao, MonitoramentoPraga } from '@/types'
import { SeveridadeBadge, worstSeveridade } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'
import { culturaLabel, culturaIcon } from '@/lib/utils'

interface Props {
  talhao: Talhao
  aplicacoes: Aplicacao[]
  monitoramentos: MonitoramentoPraga[]
  produtos: Array<{ id: string; nome: string; preco_unitario?: number }>
}

export function TalhaoDrilldown({ talhao, aplicacoes, monitoramentos, produtos }: Props) {
  const [open, setOpen] = useState(false)

  const custo = aplicacoes.reduce((sum, a) => {
    const prod = produtos.find(p => p.id === a.produto_id)
    const preco = prod?.preco_unitario ?? 0
    return sum + (a.dose ?? 0) * preco * (a.area_aplicada ?? 0)
  }, 0)

  const custoPorHa = talhao.area > 0 ? custo / talhao.area : 0
  const piorSev = worstSeveridade(monitoramentos.map(m => m.severidade))

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left transition hover:bg-black/2"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'var(--bg-dark)' }}>
          {culturaIcon(talhao.cultura)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{talhao.nome}</p>
          <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {culturaLabel(talhao.cultura)} · {talhao.area} ha
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeveridadeBadge severidade={piorSev} size="xs" />
          <span className="text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>
            {aplicacoes.length} aplic.
          </span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t" style={{ borderColor: 'var(--borda)' }}>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { label: 'Aplicações', value: aplicacoes.length },
              { label: 'Custo/ha', value: custoPorHa > 0 ? `R$ ${custoPorHa.toFixed(0)}` : '—' },
              { label: 'Monitoramentos', value: monitoramentos.length },
            ].map(k => (
              <div key={k.label} className="text-center p-2 rounded-xl" style={{ background: 'var(--bg-dark)' }}>
                <p className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{k.value}</p>
                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{k.label}</p>
              </div>
            ))}
          </div>

          {/* Monitoramentos recentes */}
          {monitoramentos.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>Monitoramentos recentes</p>
              <div className="flex flex-col gap-1">
                {[...monitoramentos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3).map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    <span style={{ color: 'var(--fg)' }}>{getAgenteLabel(talhao.cultura, m.tipo, m.agente)}</span>
                    <SeveridadeBadge severidade={m.severidade} size="xs" />
                    <span style={{ color: 'var(--fg-subtle)', marginLeft: 'auto' }}>{m.data}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top produtos */}
          {aplicacoes.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>Produtos aplicados</p>
              {Object.entries(
                aplicacoes.reduce((acc, a) => {
                  const p = produtos.find(p => p.id === a.produto_id)
                  const nome = p?.nome ?? 'Desconhecido'
                  acc[nome] = (acc[nome] ?? 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([nome, count]) => (
                <div key={nome} className="flex items-center gap-2 text-xs mb-1">
                  <span className="flex-1" style={{ color: 'var(--fg)' }}>{nome}</span>
                  <span className="font-semibold" style={{ color: 'var(--verde-700)' }}>{count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **5.9 Commit**
```
git add src/components/analytics/
git commit -m "feat: componentes analytics (KpiCard, filtros, gráficos, timeline, drilldown)"
```

---

## Task 6: Aba Monitoramento no Talhão

**Files:**
- Modify: `src/app/(app)/talhoes/[id]/page.tsx`

- [ ] **6.1 Adicionar imports e nova aba ao talhão**

No topo do arquivo, após os imports existentes:
```typescript
import type { MonitoramentoPraga } from '@/types'
import { MonitoramentoTimeline } from '@/components/monitoramento/monitoramento-timeline'
import { MonitoramentoModal } from '@/components/monitoramento/monitoramento-modal'
import { SeveridadeBadge, worstSeveridade } from '@/components/ui/severidade-badge'
import { gerarId } from '@/lib/utils'
import { enqueueSync } from '@/lib/db/sync'
```

- [ ] **6.2 Adicionar estado e funções de monitoramento**

No componente, após os estados existentes:
```typescript
const [monitoramentos, setMonitoramentos] = useState<MonitoramentoPraga[]>([])
const [modalMonitoramento, setModalMonitoramento] = useState(false)
const [editingMonitoramento, setEditingMonitoramento] = useState<MonitoramentoPraga | null>(null)
```

Dentro de `loadData()`, após carregar aplicações:
```typescript
const mons = await db.monitoramentos.where('talhao_id').equals(id as string).toArray()
setMonitoramentos(mons.sort((a, b) => b.data.localeCompare(a.data)))
```

Adicionar funções:
```typescript
async function handleSalvarMonitoramento(data: Omit<MonitoramentoPraga, 'id' | 'createdAt' | 'updatedAt' | '_syncStatus'>) {
  if (!user) return
  const db = getDB()
  const now = new Date().toISOString()
  if (editingMonitoramento) {
    const updated = { ...editingMonitoramento, ...data, updatedAt: now, _syncStatus: 'pending' as const }
    await db.monitoramentos.put(updated)
    await enqueueSync('monitoramento', 'upsert', updated as unknown as Record<string, unknown>)
    setMonitoramentos(prev => prev.map(m => m.id === updated.id ? updated : m))
  } else {
    const novo: MonitoramentoPraga = { id: gerarId(), ...data, createdAt: now, updatedAt: now, _syncStatus: 'pending' }
    await db.monitoramentos.add(novo)
    await enqueueSync('monitoramento', 'upsert', novo as unknown as Record<string, unknown>)
    setMonitoramentos(prev => [novo, ...prev])
  }
  setModalMonitoramento(false)
  setEditingMonitoramento(null)
}

async function handleDeletarMonitoramento(id: string) {
  const db = getDB()
  await db.monitoramentos.delete(id)
  setMonitoramentos(prev => prev.filter(m => m.id !== id))
}
```

- [ ] **6.3 Adicionar aba "Monitoramento" ao array de tabs e ao JSX**

Localizar onde estão as abas do talhão (ex: `type Tab = ...` e o array de tabs). Adicionar `'monitoramento'` ao tipo e renderizar:

No array de abas (próximo da tab de aplicações):
```tsx
{ id: 'monitoramento', label: 'Monitoramento', icon: Bug }
```

No render da aba (junto com as outras abas):
```tsx
{activeTab === 'monitoramento' && (
  <div className="p-4 flex flex-col gap-4">
    {talhao && monitoramentos.length > 0 && (
      <div className="flex items-center gap-2 p-3 rounded-xl"
        style={{ background: 'var(--bg-dark)', border: '1px solid var(--borda)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>Status atual:</span>
        <SeveridadeBadge severidade={worstSeveridade(monitoramentos.slice(0, 1).map(m => m.severidade))} />
      </div>
    )}
    <MonitoramentoTimeline
      registros={monitoramentos}
      cultura={talhao?.cultura ?? 'soja'}
      onNew={() => { setEditingMonitoramento(null); setModalMonitoramento(true) }}
      onEdit={(r) => { setEditingMonitoramento(r); setModalMonitoramento(true) }}
      onDelete={handleDeletarMonitoramento}
    />
    {talhao && (
      <MonitoramentoModal
        open={modalMonitoramento}
        onClose={() => { setModalMonitoramento(false); setEditingMonitoramento(null) }}
        onSave={handleSalvarMonitoramento}
        editing={editingMonitoramento}
        talhaoId={talhao.id}
        fazendaId={talhao.fazenda_id}
        usuarioId={user?.id ?? ''}
        cultura={talhao.cultura}
      />
    )}
  </div>
)}
```

Import `Bug` do lucide-react.

- [ ] **6.4 Commit**
```
git add src/app/\(app\)/talhoes/\[id\]/page.tsx
git commit -m "feat: aba Monitoramento no talhão"
```

---

## Task 7: Abas Monitoramento + Analytics na Fazenda

**Files:**
- Modify: `src/app/(app)/fazendas/[id]/page.tsx`

- [ ] **7.1 Adicionar imports**

```typescript
import type { MonitoramentoPraga } from '@/types'
import { MonitoramentoHeatmap } from '@/components/monitoramento/monitoramento-heatmap'
import { MonitoramentoAlertas } from '@/components/monitoramento/monitoramento-alertas'
import { MonitoramentoTimeline } from '@/components/monitoramento/monitoramento-timeline'
import { MonitoramentoModal } from '@/components/monitoramento/monitoramento-modal'
import { KpiCard } from '@/components/analytics/kpi-card'
import { TrendLineChart } from '@/components/analytics/trend-line-chart'
import { TypePieChart } from '@/components/analytics/type-pie-chart'
import { TalhaoDrilldown } from '@/components/analytics/talhao-drilldown'
import { BarChart3, Bug } from 'lucide-react'
import { resolvePeriodDates } from '@/store/analytics'
import { enqueueSync } from '@/lib/db/sync'
```

- [ ] **7.2 Adicionar estado e carregamento**

```typescript
const [monitoramentos, setMonitoramentos] = useState<MonitoramentoPraga[]>([])
const [modalMonitoramento, setModalMonitoramento] = useState(false)
const [editingMonitoramento, setEditingMonitoramento] = useState<MonitoramentoPraga | null>(null)
const [monTalhaoId, setMonTalhaoId] = useState<string | null>(null)
```

No `loadData()`:
```typescript
const mons = await db.monitoramentos.where('fazenda_id').equals(id as string).toArray()
setMonitoramentos(mons)
```

Funções CRUD para monitoramento da fazenda:
```typescript
async function handleSalvarMonitoramentoFazenda(data: Omit<MonitoramentoPraga, 'id' | 'createdAt' | 'updatedAt' | '_syncStatus'>) {
  if (!user) return
  const db = getDB()
  const now = new Date().toISOString()
  if (editingMonitoramento) {
    const updated = { ...editingMonitoramento, ...data, updatedAt: now, _syncStatus: 'pending' as const }
    await db.monitoramentos.put(updated)
    await enqueueSync('monitoramento', 'upsert', updated as unknown as Record<string, unknown>)
    setMonitoramentos(prev => prev.map(m => m.id === updated.id ? updated : m))
  } else {
    const novo: MonitoramentoPraga = { id: gerarId(), ...data, createdAt: now, updatedAt: now, _syncStatus: 'pending' }
    await db.monitoramentos.add(novo)
    await enqueueSync('monitoramento', 'upsert', novo as unknown as Record<string, unknown>)
    setMonitoramentos(prev => [novo, ...prev])
  }
  setModalMonitoramento(false); setEditingMonitoramento(null); setMonTalhaoId(null)
}

async function handleDeletarMonitoramentoFazenda(id: string) {
  const db = getDB()
  await db.monitoramentos.delete(id)
  setMonitoramentos(prev => prev.filter(m => m.id !== id))
}
```

- [ ] **7.3 Adicionar `'monitoramento'` e `'analytics'` ao tipo `Tab` e renderizar**

Localizar `type Tab = ...` e adicionar:
```typescript
type Tab = 'talhoes' | 'produtos' | 'mapa' | 'financeiro' | 'equipe' | 'clima' | 'monitoramento' | 'analytics'
```

No array de tabs (após 'financeiro'):
```tsx
{ id: 'monitoramento', label: 'Monitoramento', icon: Bug },
{ id: 'analytics', label: 'Analytics', icon: BarChart3 },
```

Aba Monitoramento:
```tsx
{activeTab === 'monitoramento' && (
  <div className="p-4 flex flex-col gap-4">
    <MonitoramentoAlertas
      registros={monitoramentos}
      talhoes={talhoes.map(t => ({ id: t.id, nome: t.nome, cultura: t.cultura }))}
    />
    <MonitoramentoHeatmap
      dados={talhoes.map(t => ({
        talhao: t,
        registros: monitoramentos.filter(m => m.talhao_id === t.id),
      }))}
    />
    <div className="mt-4">
      <MonitoramentoTimeline
        registros={monitoramentos}
        cultura={talhoes[0]?.cultura ?? 'soja'}
        onNew={() => { setMonTalhaoId(talhoes[0]?.id ?? null); setEditingMonitoramento(null); setModalMonitoramento(true) }}
        onEdit={(r) => { setEditingMonitoramento(r); setMonTalhaoId(r.talhao_id); setModalMonitoramento(true) }}
        onDelete={handleDeletarMonitoramentoFazenda}
      />
    </div>
    {monTalhaoId && (() => {
      const t = talhoes.find(t => t.id === monTalhaoId)
      if (!t) return null
      return (
        <MonitoramentoModal
          open={modalMonitoramento}
          onClose={() => { setModalMonitoramento(false); setEditingMonitoramento(null) }}
          onSave={handleSalvarMonitoramentoFazenda}
          editing={editingMonitoramento}
          talhaoId={t.id}
          fazendaId={t.fazenda_id}
          usuarioId={user?.id ?? ''}
          cultura={t.cultura}
        />
      )
    })()}
  </div>
)}
```

Aba Analytics (compacta):
```tsx
{activeTab === 'analytics' && (() => {
  const { from, to } = resolvePeriodDates({ fazendaId: fazenda?.id ?? null, talhaoId: null, cultura: null, periodo: '30d', dataInicio: null, dataFim: null })
  const appsInPeriod = aplicacoes.filter(a => a.data_aplicacao >= from && a.data_aplicacao <= to && !a.deleted_at)
  const atrasadas = appsInPeriod.filter(a => a.status === 'atrasado').length
  const criticos = talhoes.filter(t => {
    const mons = monitoramentos.filter(m => m.talhao_id === t.id)
    const w = worstSeveridade(mons.map(m => m.severidade))
    return w === 'severo' || w === 'critico'
  }).length
  const custo = appsInPeriod.reduce((sum, a) => {
    const prod = produtos.find(p => p.id === a.produto_id)
    return sum + (a.dose ?? 0) * (prod?.preco_unitario ?? 0) * (a.area_aplicada ?? 0)
  }, 0)

  // Trend data (weekly)
  const weekMap = new Map<string, { realizadas: number; planejadas: number }>()
  for (const a of appsInPeriod) {
    const d = new Date(a.data_aplicacao)
    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate()) / 7)}`
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, { realizadas: 0, planejadas: 0 })
    const w = weekMap.get(weekKey)!
    if (a.tipo === 'realizada') w.realizadas++ ; else w.planejadas++
  }
  const trendData = Array.from(weekMap.entries()).sort().map(([label, v]) => ({ label, ...v }))

  // Type distribution
  const typeCounts = [
    { name: 'Herbicida', value: appsInPeriod.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'herbicida').length, color: '#16a34a' },
    { name: 'Fungicida', value: appsInPeriod.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'fungicida').length, color: '#7c3aed' },
    { name: 'Inseticida', value: appsInPeriod.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'inseticida').length, color: '#dc2626' },
    { name: 'Fertilizante', value: appsInPeriod.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'fertilizante').length, color: '#d97706' },
    { name: 'Defensivo', value: appsInPeriod.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'defensivo').length, color: '#0284c7' },
  ]

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Aplicações" value={appsInPeriod.length} sub="últimos 30 dias" icon={FlaskConical} color="var(--verde-700)" />
        <KpiCard label="Atrasadas" value={atrasadas} icon={AlertTriangle} color="#dc2626" />
        <KpiCard label="Talhões críticos" value={criticos} icon={Bug} color="#7c3aed" />
        <KpiCard label="Custo total" value={custo > 0 ? `R$ ${custo.toFixed(0)}` : '—'} icon={DollarSign} color="#d97706" />
      </div>
      <div className="card p-4">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Tendência de Aplicações</p>
        <TrendLineChart data={trendData} height={200} />
      </div>
      <div className="card p-4">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Distribuição por Tipo</p>
        <TypePieChart data={typeCounts} height={200} />
      </div>
      <div className="flex justify-end">
        <Link href={`/analytics?fazenda=${fazenda?.id}`}
          className="text-sm font-semibold"
          style={{ color: 'var(--verde-700)' }}>
          Ver analytics completo →
        </Link>
      </div>
    </div>
  )
})()}
```

Adicionar imports faltantes no topo: `AlertTriangle, DollarSign, Bug, BarChart3` do lucide-react; `worstSeveridade` de `@/components/ui/severidade-badge`.

- [ ] **7.4 Commit**
```
git add src/app/\(app\)/fazendas/\[id\]/page.tsx
git commit -m "feat: abas Monitoramento + Analytics na fazenda"
```

---

## Task 8: Página Analytics Global + Sidebar + Mobile Nav

**Files:**
- Create: `src/app/(app)/analytics/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **8.1 Criar `src/app/(app)/analytics/page.tsx`**

```typescript
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { useAnalyticsStore, resolvePeriodDates } from '@/store/analytics'
import { AnalyticsFilters } from '@/components/analytics/analytics-filters'
import { KpiCard } from '@/components/analytics/kpi-card'
import { TrendLineChart } from '@/components/analytics/trend-line-chart'
import { ProductBarChart } from '@/components/analytics/product-bar-chart'
import { TypePieChart } from '@/components/analytics/type-pie-chart'
import { CropPieChart } from '@/components/analytics/crop-pie-chart'
import { EventTimeline } from '@/components/analytics/event-timeline'
import type { TimelineEvent } from '@/components/analytics/event-timeline'
import { TalhaoDrilldown } from '@/components/analytics/talhao-drilldown'
import { worstSeveridade } from '@/components/ui/severidade-badge'
import type { Fazenda, Talhao, Produto, Aplicacao, MonitoramentoPraga, CulturaType } from '@/types'
import { FlaskConical, AlertTriangle, Bug, DollarSign, Sprout, MapPin, BarChart3 } from 'lucide-react'
import { culturaLabel } from '@/lib/utils'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'

export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const { filters } = useAnalyticsStore()

  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoPraga[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const db = getDB()
    Promise.all([
      db.fazendas.toArray(),
      db.talhoes.toArray(),
      db.produtos.toArray(),
      db.aplicacoes.filter(a => !a.deleted_at).toArray(),
      db.monitoramentos.toArray(),
    ]).then(([f, t, p, a, m]) => {
      setFazendas(f); setTalhoes(t); setProdutos(p); setAplicacoes(a); setMonitoramentos(m)
    }).finally(() => setLoading(false))
  }, [user])

  const { from, to } = resolvePeriodDates(filters)

  const filteredTalhoes = useMemo(() => talhoes.filter(t => {
    if (filters.fazendaId && t.fazenda_id !== filters.fazendaId) return false
    if (filters.talhaoId && t.id !== filters.talhaoId) return false
    if (filters.cultura && t.cultura !== filters.cultura) return false
    return true
  }), [talhoes, filters])

  const talhaoIds = new Set(filteredTalhoes.map(t => t.id))

  const filteredApps = useMemo(() =>
    aplicacoes.filter(a =>
      talhaoIds.has(a.talhao_id) &&
      a.data_aplicacao >= from &&
      a.data_aplicacao <= to
    ), [aplicacoes, talhaoIds, from, to])

  const filteredMons = useMemo(() =>
    monitoramentos.filter(m => talhaoIds.has(m.talhao_id)),
    [monitoramentos, talhaoIds])

  // KPIs
  const atrasadas = filteredApps.filter(a => a.status === 'atrasado').length
  const criticos = filteredTalhoes.filter(t => {
    const w = worstSeveridade(filteredMons.filter(m => m.talhao_id === t.id).map(m => m.severidade))
    return w === 'severo' || w === 'critico'
  }).length
  const custo = filteredApps.reduce((sum, a) => {
    const p = produtos.find(p => p.id === a.produto_id)
    return sum + (a.dose ?? 0) * (p?.preco_unitario ?? 0) * (a.area_aplicada ?? 0)
  }, 0)
  const areaSemeada = filteredTalhoes.reduce((s, t) => s + (t.area_semeada ?? 0), 0)
  const areaTotal = filteredTalhoes.reduce((s, t) => s + t.area, 0)
  const indiceSemeadura = areaTotal > 0 ? Math.round((areaSemeada / areaTotal) * 100) : 0

  // Trend data
  const trendData = useMemo(() => {
    const weekMap = new Map<string, { realizadas: number; planejadas: number }>()
    for (const a of filteredApps) {
      const d = new Date(a.data_aplicacao)
      const week = `Sem ${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('pt-BR', { month: 'short' })}`
      if (!weekMap.has(week)) weekMap.set(week, { realizadas: 0, planejadas: 0 })
      const w = weekMap.get(week)!
      if (a.tipo === 'realizada') w.realizadas++; else w.planejadas++
    }
    return Array.from(weekMap.entries()).map(([label, v]) => ({ label, ...v }))
  }, [filteredApps])

  // Product usage
  const productData = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of filteredApps) {
      const p = produtos.find(p => p.id === a.produto_id)
      const nome = p?.nome ?? 'Desconhecido'
      map.set(nome, (map.get(nome) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([nome, quantidade]) => ({ nome, quantidade }))
  }, [filteredApps, produtos])

  // Type distribution
  const typeData = useMemo(() => [
    { name: 'Herbicida',    value: filteredApps.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'herbicida').length,    color: '#16a34a' },
    { name: 'Fungicida',    value: filteredApps.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'fungicida').length,    color: '#7c3aed' },
    { name: 'Inseticida',   value: filteredApps.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'inseticida').length,   color: '#dc2626' },
    { name: 'Fertilizante', value: filteredApps.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'fertilizante').length, color: '#d97706' },
    { name: 'Defensivo',    value: filteredApps.filter(a => produtos.find(p => p.id === a.produto_id)?.tipo === 'defensivo').length,    color: '#0284c7' },
  ], [filteredApps, produtos])

  // Crop distribution
  const cropData = useMemo(() => {
    const culturas = [...new Set(filteredTalhoes.map(t => t.cultura))] as CulturaType[]
    return culturas.map(c => ({ cultura: c, count: filteredApps.filter(a => filteredTalhoes.find(t => t.id === a.talhao_id)?.cultura === c).length }))
  }, [filteredTalhoes, filteredApps])

  // Events timeline
  const events = useMemo((): TimelineEvent[] => {
    const evs: TimelineEvent[] = []
    for (const a of filteredApps.slice(0, 30)) {
      const t = filteredTalhoes.find(t => t.id === a.talhao_id)
      const p = produtos.find(p => p.id === a.produto_id)
      evs.push({ id: a.id, tipo: 'aplicacao', data: a.data_aplicacao, descricao: `${p?.nome ?? 'Produto'} aplicado`, talhaoNome: t?.nome })
    }
    for (const m of filteredMons.filter(m => m.severidade === 'severo' || m.severidade === 'critico').slice(0, 10)) {
      const t = filteredTalhoes.find(t => t.id === m.talhao_id)
      evs.push({ id: m.id, tipo: 'monitoramento', data: m.data, descricao: getAgenteLabel(t?.cultura ?? 'soja', m.tipo, m.agente), talhaoNome: t?.nome, severity: 'alert' })
    }
    return evs
  }, [filteredApps, filteredMons, filteredTalhoes, produtos])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--verde-500)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={20} style={{ color: 'var(--verde-700)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Analytics</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Visão estratégica da sua operação agrícola</p>
      </div>

      <AnalyticsFilters fazendas={fazendas} talhoes={talhoes} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Aplicações" value={filteredApps.length} sub={`${from} → ${to}`} icon={FlaskConical} color="var(--verde-700)" />
        <KpiCard label="Atrasadas" value={atrasadas} icon={AlertTriangle} color="#dc2626" />
        <KpiCard label="Talhões críticos" value={criticos} icon={Bug} color="#7c3aed" />
        <KpiCard label="Custo total" value={custo > 0 ? `R$ ${custo.toFixed(0)}` : '—'} icon={DollarSign} color="#d97706" />
        <KpiCard label="Semeadura" value={`${indiceSemeadura}%`} sub={`${areaSemeada.toFixed(0)} / ${areaTotal.toFixed(0)} ha`} icon={Sprout} color="#16a34a" />
        <KpiCard label="Talhões" value={filteredTalhoes.length} sub={`de ${talhoes.length} total`} icon={MapPin} color="#0284c7" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Tendência de Aplicações</p>
          <TrendLineChart data={trendData} />
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Produtos Mais Usados</p>
          <ProductBarChart data={productData} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Por Tipo de Produto</p>
          <TypePieChart data={typeData} />
        </div>
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Por Cultura</p>
          <CropPieChart data={cropData} />
        </div>
      </div>

      {/* Timeline */}
      <div className="card p-4 mb-4">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Timeline de Eventos</p>
        <EventTimeline events={events} />
      </div>

      {/* Drill-down */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--fg)' }}>Análise por Talhão</p>
        <div className="flex flex-col gap-2">
          {filteredTalhoes.map(t => (
            <TalhaoDrilldown
              key={t.id}
              talhao={t}
              aplicacoes={filteredApps.filter(a => a.talhao_id === t.id)}
              monitoramentos={filteredMons.filter(m => m.talhao_id === t.id)}
              produtos={produtos}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **8.2 Atualizar `src/components/layout/sidebar.tsx`**

No array `nav`, adicionar após `alertas`:
```typescript
{ href: '/analytics', icon: BarChart3, label: 'Analytics', sub: 'Relatórios' },
```

Importar `BarChart3` do lucide-react.

- [ ] **8.3 Atualizar `src/components/layout/mobile-nav.tsx`**

Substituir uma entrada menos usada ou adicionar `analytics` ao nav mobile. Substituir `recomendacoes` por `analytics` (recomendações acessível via sidebar desktop):

```typescript
import { LayoutDashboard, MapPin, FlaskConical, CalendarDays, BarChart3 } from 'lucide-react'

const nav = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Início'   },
  { href: '/fazendas',    icon: MapPin,           label: 'Fazendas' },
  { href: '/aplicacoes',  icon: FlaskConical,     label: 'Aplicar'  },
  { href: '/analytics',   icon: BarChart3,        label: 'Analytics'},
  { href: '/cronograma',  icon: CalendarDays,     label: 'Agenda'   },
]
```

- [ ] **8.4 Commit**
```
git add src/app/\(app\)/analytics/ src/components/layout/sidebar.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: página Analytics global + navegação sidebar/mobile"
```

---

## Task 9: Instalar Recharts + Typecheck + Deploy

- [ ] **9.1 Instalar Recharts**
```
npm install recharts
```

- [ ] **9.2 Typecheck**
```
npx tsc --noEmit
```
Corrigir erros se houver.

- [ ] **9.3 Commit final e push**
```
git add package.json package-lock.json
git commit -m "feat: instala recharts para analytics"
git push origin main
```
