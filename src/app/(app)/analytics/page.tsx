'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { useAnalyticsStore, resolvePeriodDates } from '@/store/analytics'
import { AnalyticsFilters } from '@/components/analytics/analytics-filters'
import { KpiCard } from '@/components/analytics/kpi-card'
import { TrendLineChart } from '@/components/analytics/trend-line-chart'
import { ProductBarChart } from '@/components/analytics/product-bar-chart'
import { TypePieChart } from '@/components/analytics/type-pie-chart'
import { CropPieChart } from '@/components/analytics/crop-pie-chart'
import { EventTimeline } from '@/components/analytics/event-timeline'
import { TalhaoAnalyticsDrilldown } from '@/components/analytics/talhao-drilldown'
import { worstSeveridade } from '@/components/ui/severidade-badge'
import type { Fazenda, Talhao, Produto, Aplicacao, SemeaduraEtapa, MonitoramentoPraga, CulturaType } from '@/types'
import { FlaskConical, Leaf, Bug, DollarSign, Sprout, Eye, BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const lastServerSyncAt = useAppStore(s => s.lastServerSyncAt)

  const [fazendas,   setFazendas]   = useState<Fazenda[]>([])
  const [talhoes,    setTalhoes]    = useState<Talhao[]>([])
  const [produtos,   setProdutos]   = useState<Produto[]>([])
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [etapas,     setEtapas]     = useState<SemeaduraEtapa[]>([])
  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoPraga[]>([])

  const { fazendaId, talhaoId, cultura, period, customFrom, customTo } = useAnalyticsStore()

  const loadData = useCallback(async () => {
    if (!user) return
    const db = getDB()
    const [fazs, tals, prods, apps, ets, mons] = await Promise.all([
      db.fazendas.where('usuario_id').equals(user.id).toArray(),
      db.talhoes.toArray(),
      db.produtos.toArray(),
      db.aplicacoes.filter(a => !a.deleted_at).toArray(),
      db.semeaduraEtapas.toArray(),
      db.monitoramentos.toArray(),
    ])
    setFazendas(fazs)
    setTalhoes(tals)
    setProdutos(prods)
    setAplicacoes(apps)
    setEtapas(ets)
    setMonitoramentos(mons)
  }, [user])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt, loadData])

  const { from, to } = useMemo(
    () => resolvePeriodDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  )

  // Apply filters
  const filteredTalhoes = useMemo(() => {
    let ts = talhoes
    if (fazendaId) ts = ts.filter(t => t.fazenda_id === fazendaId)
    if (talhaoId)  ts = ts.filter(t => t.id === talhaoId)
    if (cultura)   ts = ts.filter(t => t.cultura === cultura)
    return ts
  }, [talhoes, fazendaId, talhaoId, cultura])

  const talhaoIds = useMemo(() => new Set(filteredTalhoes.map(t => t.id)), [filteredTalhoes])

  const filteredAplicacoes = useMemo(() =>
    aplicacoes.filter(a =>
      talhaoIds.has(a.talhao_id) &&
      a.data_aplicacao >= from &&
      a.data_aplicacao <= to
    ),
  [aplicacoes, talhaoIds, from, to])

  const filteredMonitoramentos = useMemo(() =>
    monitoramentos.filter(m => talhaoIds.has(m.talhao_id)),
  [monitoramentos, talhaoIds])

  const filteredEtapas = useMemo(() =>
    etapas.filter(e => talhaoIds.has(e.talhao_id)),
  [etapas, talhaoIds])

  // KPIs
  const kpiAplicacoes = filteredAplicacoes.length
  const kpiAtrasadas  = aplicacoes.filter(a => talhaoIds.has(a.talhao_id) && a.status === 'atrasado').length
  const kpiCriticos   = filteredTalhoes.filter(t => {
    const mons = filteredMonitoramentos.filter(m => m.talhao_id === t.id)
    const worst = worstSeveridade(mons.map(m => m.severidade))
    return worst === 'severo' || worst === 'critico'
  }).length
  const kpiCustoTotal = useMemo(() => {
    const prodMap = new Map(produtos.map(p => [p.id, p]))
    return filteredAplicacoes.reduce((sum, a) => {
      const prod = prodMap.get(a.produto_id)
      if (!prod?.preco_unitario || !a.dose || !a.area_aplicada) return sum
      return sum + (a.dose * prod.preco_unitario * a.area_aplicada)
    }, 0)
  }, [filteredAplicacoes, produtos])

  const kpiAreaTotal   = filteredTalhoes.reduce((s, t) => s + t.area, 0)
  const kpiAreaMonitorada = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)
    return filteredTalhoes.filter(t =>
      filteredMonitoramentos.some(m => m.talhao_id === t.id && m.data >= cutoff)
    ).length
  }, [filteredTalhoes, filteredMonitoramentos])

  if (!user) return null

  return (
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(160 84% 22% / 0.12)' }}>
          <BarChart3 size={18} style={{ color: 'hsl(160 84% 22%)' }} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>Analytics</h1>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Relatórios e indicadores da operação</p>
        </div>
      </div>

      {/* Filters */}
      <div className="animate-enter animate-enter-2">
        <AnalyticsFilters fazendas={fazendas} talhoes={talhoes} />
      </div>

      {/* KPI Cards */}
      <div className="animate-enter animate-enter-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 mt-4">
        <KpiCard label="Aplicações" value={kpiAplicacoes} icon={FlaskConical} color="hsl(160 84% 22%)" sub="no período" />
        <KpiCard label="Atrasadas"  value={kpiAtrasadas}  icon={FlaskConical} color="hsl(0 72% 51%)"   sub="aguardando" />
        <KpiCard label="Talhões críticos" value={kpiCriticos} icon={Bug} color="hsl(38 90% 50%)" />
        <KpiCard label="Custo total" value={`R$ ${kpiCustoTotal.toFixed(0)}`} icon={DollarSign} color="hsl(160 50% 38%)" />
        <KpiCard label="Área total" value={`${kpiAreaTotal.toFixed(0)} ha`} icon={Leaf} color="hsl(210 100% 50%)" />
        <KpiCard label="Monitorados" value={`${kpiAreaMonitorada} talhões`} icon={Eye} color="hsl(280 70% 55%)" sub="últ. 30d" />
      </div>

      {/* Charts row 1 */}
      <div className="animate-enter animate-enter-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <p className="section-label mb-3">Tendência de aplicações</p>
          <TrendLineChart aplicacoes={filteredAplicacoes} from={from} to={to} />
        </div>
        <div className="card p-4">
          <p className="section-label mb-3">Distribuição por tipo</p>
          <TypePieChart aplicacoes={filteredAplicacoes} produtos={produtos} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="animate-enter animate-enter-5 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="section-label mb-3">Produtos mais usados</p>
          <ProductBarChart aplicacoes={filteredAplicacoes} produtos={produtos} />
        </div>
        <div className="card p-4">
          <p className="section-label mb-3">Distribuição por cultura</p>
          <CropPieChart talhoes={filteredTalhoes} />
        </div>
      </div>

      {/* Event Timeline */}
      <div className="animate-enter animate-enter-6 card p-4 mb-6">
        <p className="section-label mb-3">Timeline de eventos</p>
        <EventTimeline
          aplicacoes={filteredAplicacoes}
          semeadurasEtapas={filteredEtapas}
          monitoramentos={filteredMonitoramentos}
          talhoes={filteredTalhoes}
          from={from}
          to={to}
        />
      </div>

      {/* Drill-down */}
      <div className="animate-enter animate-enter-7">
        <p className="section-label mb-3">Detalhe por talhão</p>
        <TalhaoAnalyticsDrilldown
          talhoes={filteredTalhoes}
          aplicacoes={filteredAplicacoes}
          monitoramentos={filteredMonitoramentos}
          produtos={produtos}
          from={from}
          to={to}
        />
      </div>
    </div>
  )
}
