'use client'
import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Award, AlertTriangle } from 'lucide-react'
import type { Safra, Aplicacao, MonitoramentoPraga, Produto, Talhao, CulturaType } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'
import { worstSeveridade } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'
import { parseISO, differenceInDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SafraMetrics {
  safra: Safra
  aplicacoes: Aplicacao[]
  monitoramentos: MonitoramentoPraga[]
  countAplicacoes: number
  countMonitoramentos: number
  custoTotal: number
  custoHa: number
  diasCiclo: number | null
  piorSeveridade: string
  countPragas: number
  countDoencas: number
  produtividade: number | null
  tiposUsados: Record<string, number>
  agentesFrequentes: { label: string; count: number }[]
}

interface SafraComparativoProps {
  safras: Safra[]
  aplicacoes: Aplicacao[]
  monitoramentos: MonitoramentoPraga[]
  produtos: Produto[]
  talhoes: Talhao[]
  fazendaId?: string | null
}

const COLORS = [
  'hsl(160 84% 22%)',
  'hsl(210 100% 50%)',
  'hsl(38 90% 50%)',
  'hsl(280 70% 55%)',
  'hsl(0 72% 51%)',
]

function TrendBadge({ current, previous, suffix = '', lowerIsBetter = false }: { current: number; previous: number; suffix?: string; lowerIsBetter?: boolean }) {
  if (previous === 0 || current === previous) return <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 2 }}><Minus size={11} /> igual</span>
  const pct = ((current - previous) / previous * 100)
  const improved = lowerIsBetter ? current < previous : current > previous
  const color = improved ? '#22c55e' : '#ef4444'
  const Icon = improved ? TrendingUp : TrendingDown
  return (
    <span style={{ fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
      <Icon size={11} /> {pct > 0 ? '+' : ''}{pct.toFixed(0)}%{suffix}
    </span>
  )
}

export function SafraComparativo({ safras, aplicacoes, monitoramentos, produtos, talhoes, fazendaId }: SafraComparativoProps) {
  const [expandedSafra, setExpandedSafra] = useState<string | null>(null)

  const prodMap = useMemo(() => new Map(produtos.map(p => [p.id, p])), [produtos])
  const talhaoMap = useMemo(() => new Map(talhoes.map(t => [t.id, t])), [talhoes])

  // Filter by fazenda if provided
  const filteredSafras = useMemo(() =>
    fazendaId ? safras.filter(s => s.fazenda_id === fazendaId) : safras,
  [safras, fazendaId])

  const metrics: SafraMetrics[] = useMemo(() => {
    return filteredSafras.map(safra => {
      // Apps linked to safra OR by date range (best-effort)
      const from = safra.data_plantio ?? `${safra.ano_inicio}-01-01`
      const to   = safra.data_colheita_real ?? safra.data_colheita_prevista ?? `${safra.ano_fim}-12-31`

      const safraTalhoes = talhoes.filter(t => t.fazenda_id === safra.fazenda_id)
      const talhaoIds = new Set(safraTalhoes.map(t => t.id))

      const safrApps = aplicacoes.filter(a =>
        (a.safra_id === safra.id) ||
        (talhaoIds.has(a.talhao_id) && a.data_aplicacao >= from && a.data_aplicacao <= to)
      )

      const safraMons = monitoramentos.filter(m =>
        talhaoIds.has(m.talhao_id) && m.data >= from && m.data <= to
      )

      const custoTotal = safrApps.reduce((sum, a) => {
        const prod = prodMap.get(a.produto_id)
        if (!prod?.preco_unitario || !a.dose || !a.area_aplicada) return sum
        return sum + (a.dose * prod.preco_unitario * a.area_aplicada)
      }, 0)

      const areaTotal = safra.area_plantada ?? safraTalhoes.reduce((s, t) => s + t.area, 0)
      const custoHa = areaTotal > 0 ? custoTotal / areaTotal : 0

      const diasCiclo = safra.data_plantio && (safra.data_colheita_real || safra.data_colheita_prevista)
        ? differenceInDays(
            parseISO(safra.data_colheita_real ?? safra.data_colheita_prevista!),
            parseISO(safra.data_plantio)
          )
        : null

      const piorSev = worstSeveridade(safraMons.map(m => m.severidade))

      const tiposUsados: Record<string, number> = {}
      for (const a of safrApps) {
        const tipo = prodMap.get(a.produto_id)?.tipo ?? 'outro'
        tiposUsados[tipo] = (tiposUsados[tipo] ?? 0) + 1
      }

      // Most frequent pest/disease agents
      const agentCount = new Map<string, number>()
      for (const m of safraMons) {
        const talhao = talhaoMap.get(m.talhao_id)
        if (!talhao) continue
        const label = getAgenteLabel(talhao.cultura as CulturaType, m.tipo === 'praga' ? 'praga' : 'doenca', m.agente)
        agentCount.set(label, (agentCount.get(label) ?? 0) + 1)
      }
      const agentesFrequentes = Array.from(agentCount.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      return {
        safra,
        aplicacoes: safrApps,
        monitoramentos: safraMons,
        countAplicacoes: safrApps.length,
        countMonitoramentos: safraMons.length,
        custoTotal,
        custoHa,
        diasCiclo,
        piorSeveridade: piorSev,
        countPragas:  safraMons.filter(m => m.tipo === 'praga').length,
        countDoencas: safraMons.filter(m => m.tipo === 'doenca').length,
        produtividade: safra.produtividade_media ?? null,
        tiposUsados,
        agentesFrequentes,
      }
    }).sort((a, b) => b.safra.ano_inicio - a.safra.ano_inicio)
  }, [filteredSafras, aplicacoes, monitoramentos, prodMap, talhaoMap, talhoes])

  // ── Bar chart data: applications + cost per season ─────────────────────────
  const barData = useMemo(() =>
    [...metrics].reverse().map(m => ({
      nome: m.safra.nome,
      aplicacoes:  m.countAplicacoes,
      pragas:      m.countPragas,
      doencas:     m.countDoencas,
      custoHa:     Math.round(m.custoHa),
    })),
  [metrics])

  // ── Radar chart: normalized scores per season ─────────────────────────────
  const radarData = useMemo(() => {
    if (metrics.length < 2) return []
    const maxApp  = Math.max(...metrics.map(m => m.countAplicacoes), 1)
    const maxCusto = Math.max(...metrics.map(m => m.custoHa), 1)
    const maxMon   = Math.max(...metrics.map(m => m.countMonitoramentos), 1)
    const axes = ['Aplicações', 'Custo/ha', 'Pragas', 'Doenças', 'Produtividade']
    return axes.map(subject => {
      const row: Record<string, number | string> = { subject }
      for (const m of metrics.slice(0, 4)) { // max 4 seasons
        row[m.safra.nome] = subject === 'Aplicações' ? (m.countAplicacoes / maxApp * 100)
          : subject === 'Custo/ha'  ? (m.custoHa / maxCusto * 100)
          : subject === 'Pragas'    ? (m.countPragas / Math.max(...metrics.map(x => x.countPragas), 1) * 100)
          : subject === 'Doenças'   ? (m.countDoencas / Math.max(...metrics.map(x => x.countDoencas), 1) * 100)
          : m.produtividade ? (m.produtividade / Math.max(...metrics.map(x => x.produtividade ?? 0), 1) * 100)
          : 0
      }
      return row
    })
  }, [metrics])

  if (metrics.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)' }}>
        <p style={{ fontSize: 13 }}>Nenhuma safra registrada</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>As safras são criadas automaticamente ao definir o plantio dos talhões.</p>
      </div>
    )
  }

  const current = metrics[0]
  const previous = metrics[1]

  const SEV_LABELS: Record<string, string> = { nenhum: '✅ Nenhum', leve: '🟢 Leve', moderado: '🟡 Moderado', severo: '🟠 Severo', critico: '🔴 Crítico' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Resumo safra atual vs. anterior ── */}
      {previous && (
        <div className="card p-4">
          <p className="section-label mb-3">Safra atual vs. anterior</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { label: 'Aplicações',      curr: current.countAplicacoes,    prev: previous.countAplicacoes,    fmt: (v: number) => v.toString(),             lowerIsBetter: false },
              { label: 'Custo/ha (R$)',   curr: current.custoHa,            prev: previous.custoHa,            fmt: (v: number) => v.toFixed(0),             lowerIsBetter: true  },
              { label: 'Incidências',     curr: current.countMonitoramentos, prev: previous.countMonitoramentos, fmt: (v: number) => v.toString(),            lowerIsBetter: true  },
              { label: 'Produtividade',   curr: current.produtividade ?? 0,  prev: previous.produtividade ?? 0, fmt: (v: number) => v ? `${v} sc/ha` : '-',  lowerIsBetter: false },
            ].map(({ label, curr, prev, fmt, lowerIsBetter }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg)', marginBottom: 4 }}>{fmt(curr)}</div>
                <TrendBadge current={curr} previous={prev} lowerIsBetter={lowerIsBetter} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bar chart: evolution ── */}
      {barData.length > 0 && (
        <div className="card p-4">
          <p className="section-label mb-3">Evolução entre safras</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left"  dataKey="aplicacoes" name="Aplicações" fill={COLORS[0]} radius={[4,4,0,0]} />
              <Bar yAxisId="left"  dataKey="pragas"     name="Pragas"     fill={COLORS[2]} radius={[4,4,0,0]} />
              <Bar yAxisId="left"  dataKey="doencas"    name="Doenças"    fill={COLORS[1]} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Radar chart: seasonal profile ── */}
      {radarData.length > 0 && metrics.length >= 2 && (
        <div className="card p-4">
          <p className="section-label mb-3">Perfil por safra (normalizado)</p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--borda)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
              {metrics.slice(0, 4).map((m, i) => (
                <Radar key={m.safra.id} name={m.safra.nome} dataKey={m.safra.nome} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.10} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 8, fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Per-season accordion cards ── */}
      <div>
        <p className="section-label mb-3">Detalhe por safra</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {metrics.map((m, idx) => {
            const isOpen = expandedSafra === m.safra.id
            const isCurrent = idx === 0
            return (
              <div key={m.safra.id} style={{
                background: 'var(--bg-card)',
                border: `1.5px solid ${isCurrent ? 'hsl(160 84% 22% / 0.35)' : 'var(--borda)'}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <button
                  onClick={() => setExpandedSafra(isOpen ? null : m.safra.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 16 }}>{culturaIcon(m.safra.cultura)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{m.safra.nome}</span>
                      {isCurrent && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'hsl(160 84% 22% / 0.12)', color: 'hsl(160 84% 22%)' }}>
                          Atual
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{culturaLabel(m.safra.cultura)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                      {m.countAplicacoes} aplicações · {m.countMonitoramentos} monitoramentos
                      {m.custoHa > 0 ? ` · R$ ${m.custoHa.toFixed(0)}/ha` : ''}
                    </div>
                  </div>
                  {m.safra.status === 'finalizada' && m.produtividade && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'hsl(160 84% 22%)' }}>{m.produtividade} sc/ha</div>
                      <div style={{ fontSize: 10, color: 'var(--fg-subtle)' }}>produtividade</div>
                    </div>
                  )}
                  {isOpen ? <ChevronUp size={14} color="var(--fg-subtle)" /> : <ChevronDown size={14} color="var(--fg-subtle)" />}
                </button>

                {/* Expanded body */}
                {isOpen && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ height: 1, background: 'var(--borda)' }} />

                    {/* Metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                      {[
                        { label: 'Aplicações',  value: m.countAplicacoes.toString() },
                        { label: 'Custo total', value: m.custoTotal > 0 ? `R$ ${m.custoTotal.toFixed(0)}` : '-' },
                        { label: 'Custo/ha',    value: m.custoHa > 0 ? `R$ ${m.custoHa.toFixed(0)}` : '-' },
                        { label: 'Ciclo',       value: m.diasCiclo ? `${m.diasCiclo} dias` : '-' },
                        { label: 'Pragas',      value: m.countPragas.toString() },
                        { label: 'Doenças',     value: m.countDoencas.toString() },
                        { label: 'Pior nível',  value: SEV_LABELS[m.piorSeveridade] ?? m.piorSeveridade },
                        ...(m.produtividade ? [{ label: 'Produtividade', value: `${m.produtividade} sc/ha` }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Product types */}
                    {Object.keys(m.tiposUsados).length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>Tipos de produto usados</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {Object.entries(m.tiposUsados).map(([tipo, count]) => (
                            <span key={tipo} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: 'hsl(160 84% 22% / 0.10)', color: 'hsl(160 84% 22%)' }}>
                              {tipo} × {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Frequent agents */}
                    {m.agentesFrequentes.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>Agentes mais frequentes</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {m.agentesFrequentes.map(({ label, count }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-dark)', overflow: 'hidden' }}>
                                <div style={{ width: `${(count / m.agentesFrequentes[0].count) * 100}%`, height: '100%', background: 'hsl(38 90% 50%)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--fg)', minWidth: 60 }}>{label}</span>
                              <span style={{ fontSize: 11, color: 'var(--fg-subtle)', minWidth: 20, textAlign: 'right' }}>{count}×</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Datas */}
                    {(m.safra.data_plantio || m.safra.data_colheita_real) && (
                      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {m.safra.data_plantio && (
                          <span>Plantio: <strong style={{ color: 'var(--fg)' }}>
                            {format(parseISO(m.safra.data_plantio), 'dd/MM/yyyy', { locale: ptBR })}
                          </strong></span>
                        )}
                        {m.safra.data_colheita_real && (
                          <span>Colheita: <strong style={{ color: 'var(--fg)' }}>
                            {format(parseISO(m.safra.data_colheita_real), 'dd/MM/yyyy', { locale: ptBR })}
                          </strong></span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Insight: recurring agents ── */}
      <RecorrenciaAgentes metrics={metrics} />
    </div>
  )
}

/** Shows agents that appeared in multiple seasons — a pattern worth knowing */
function RecorrenciaAgentes({ metrics }: { metrics: SafraMetrics[] }) {
  if (metrics.length < 2) return null

  const agentSafras = new Map<string, Set<string>>()
  for (const m of metrics) {
    for (const a of m.agentesFrequentes) {
      if (!agentSafras.has(a.label)) agentSafras.set(a.label, new Set())
      agentSafras.get(a.label)!.add(m.safra.nome)
    }
  }

  const recorrentes = Array.from(agentSafras.entries())
    .filter(([, safraSet]) => safraSet.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)

  if (recorrentes.length === 0) return null

  return (
    <div className="card p-4">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <AlertTriangle size={14} style={{ color: 'hsl(38 90% 40%)' }} />
        <p className="section-label">Agentes recorrentes entre safras</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recorrentes.map(([agent, safraSet]) => (
          <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'hsl(38 90% 50% / 0.08)', border: '1px solid hsl(38 90% 50% / 0.20)' }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{agent}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>apareceu em {safraSet.size} safras:</span>
            <span style={{ fontSize: 11, color: 'hsl(38 90% 40%)', fontWeight: 700 }}>{Array.from(safraSet).join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
