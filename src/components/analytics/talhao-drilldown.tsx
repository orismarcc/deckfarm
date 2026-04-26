'use client'
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Talhao, Aplicacao, MonitoramentoPraga, Produto, CulturaType } from '@/types'
import { SeveridadeBadge } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'
import { SEVERIDADE_ORDER } from '@/components/ui/severidade-badge'

interface TalhaoAnalyticsDrilldownProps {
  talhoes: Talhao[]
  aplicacoes: Aplicacao[]
  monitoramentos: MonitoramentoPraga[]
  produtos: Produto[]
  from: string
  to: string
}

export function TalhaoAnalyticsDrilldown({
  talhoes, aplicacoes, monitoramentos, produtos, from, to,
}: TalhaoAnalyticsDrilldownProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {talhoes.map(talhao => (
        <TalhaoAccordion
          key={talhao.id}
          talhao={talhao}
          aplicacoes={aplicacoes.filter(a => a.talhao_id === talhao.id)}
          monitoramentos={monitoramentos.filter(m => m.talhao_id === talhao.id)}
          produtos={produtos}
          from={from}
          to={to}
          open={openId === talhao.id}
          onToggle={() => setOpenId(prev => prev === talhao.id ? null : talhao.id)}
        />
      ))}
    </div>
  )
}

interface TalhaoAccordionProps {
  talhao: Talhao
  aplicacoes: Aplicacao[]
  monitoramentos: MonitoramentoPraga[]
  produtos: Produto[]
  from: string
  to: string
  open: boolean
  onToggle: () => void
}

function TalhaoAccordion({ talhao, aplicacoes, monitoramentos, produtos, from, to, open, onToggle }: TalhaoAccordionProps) {
  const appCount = aplicacoes.length

  // Cost per ha
  const custoHa = useMemo(() => {
    if (!talhao.area) return null
    const total = aplicacoes.reduce((sum, a) => {
      const prod = produtos.find(p => p.id === a.produto_id)
      if (!prod?.preco_unitario || !a.dose || !a.area_aplicada) return sum
      return sum + (a.dose * prod.preco_unitario * a.area_aplicada)
    }, 0)
    return total > 0 ? (total / talhao.area).toFixed(2) : null
  }, [aplicacoes, produtos, talhao.area])

  // Aplicacoes by produto (top 5)
  const appByProd = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of aplicacoes) counts.set(a.produto_id, (counts.get(a.produto_id) ?? 0) + 1)
    return Array.from(counts.entries())
      .map(([id, count]) => ({ name: produtos.find(p => p.id === id)?.nome ?? id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [aplicacoes, produtos])

  // Monitoramento severity over time
  const sevTimeline = useMemo(() => {
    return [...monitoramentos]
      .sort((a, b) => a.data.localeCompare(b.data))
      .filter(m => m.data >= from && m.data <= to)
      .map(m => ({
        date: (() => { try { return format(parseISO(m.data), 'dd/MM', { locale: ptBR }) } catch { return m.data } })(),
        severidade: SEVERIDADE_ORDER.indexOf(m.severidade),
        label: getAgenteLabel(talhao.cultura as CulturaType, m.tipo === 'praga' ? 'praga' : 'doenca', m.agente),
      }))
  }, [monitoramentos, from, to, talhao.cultura])

  // Latest monitoring
  const latestMon = useMemo(() => {
    return [...monitoramentos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3)
  }, [monitoramentos])

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{talhao.nome}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
            {talhao.area} ha · {appCount} aplicação{appCount !== 1 ? 'ões' : ''}
            {custoHa ? ` · R$ ${custoHa}/ha` : ''}
          </div>
        </div>
        {open ? <ChevronUp size={14} color="var(--fg-subtle)" /> : <ChevronDown size={14} color="var(--fg-subtle)" />}
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 1, background: 'var(--borda)' }} />

          {/* Aplicacoes por produto */}
          {appByProd.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', marginBottom: 8 }}>Aplicações por produto</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={appByProd} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" fill="hsl(160 84% 22%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monitoramento timeline */}
          {sevTimeline.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', marginBottom: 8 }}>Severidade ao longo do tempo</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={sevTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tickFormatter={v => ['N', 'L', 'M', 'S', 'C'][v] ?? ''} />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => [['Nenhum', 'Leve', 'Moderado', 'Severo', 'Crítico'][Number(v)] ?? v, 'Severidade']} />
                  <Line type="monotone" dataKey="severidade" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent monitoring records */}
          {latestMon.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', marginBottom: 6 }}>Monitoramentos recentes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {latestMon.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--fg-subtle)', width: 50, flexShrink: 0 }}>{m.data.slice(5).replace('-', '/')}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg)', flex: 1 }}>
                      {getAgenteLabel(talhao.cultura as CulturaType, m.tipo === 'praga' ? 'praga' : 'doenca', m.agente)}
                    </span>
                    <SeveridadeBadge severidade={m.severidade} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
