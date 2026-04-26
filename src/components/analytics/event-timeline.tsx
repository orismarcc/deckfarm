'use client'
import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FlaskConical, Sprout, Bug } from 'lucide-react'
import type { Aplicacao, SemeaduraEtapa, MonitoramentoPraga, Talhao, CulturaType } from '@/types'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'

type EventType = 'aplicacao' | 'semeadura' | 'monitoramento'

interface TimelineEvent {
  id: string
  type: EventType
  date: string
  label: string
  sub?: string
  color: string
}

interface EventTimelineProps {
  aplicacoes: Aplicacao[]
  semeadurasEtapas: SemeaduraEtapa[]
  monitoramentos: MonitoramentoPraga[]
  talhoes: Talhao[]
  from: string
  to: string
  maxItems?: number
}

export function EventTimeline({
  aplicacoes, semeadurasEtapas, monitoramentos, talhoes, from, to, maxItems = 30,
}: EventTimelineProps) {
  const talhaoMap = useMemo(() => new Map(talhoes.map(t => [t.id, t])), [talhoes])

  const events: TimelineEvent[] = useMemo(() => {
    const all: TimelineEvent[] = []

    for (const a of aplicacoes) {
      const d = a.data_aplicacao?.slice(0, 10)
      if (d && d >= from && d <= to) {
        const talhao = talhaoMap.get(a.talhao_id)
        all.push({
          id: a.id,
          type: 'aplicacao',
          date: d,
          label: `Aplicação${a.tipo === 'planejada' ? ' (planejada)' : ''}`,
          sub: talhao ? talhao.nome : undefined,
          color: 'hsl(160 84% 22%)',
        })
      }
    }

    for (const s of semeadurasEtapas) {
      const d = s.data_semeadura?.slice(0, 10)
      if (d && d >= from && d <= to) {
        const talhao = talhaoMap.get(s.talhao_id)
        all.push({
          id: s.id,
          type: 'semeadura',
          date: d,
          label: `Semeadura — etapa ${s.etapa}`,
          sub: talhao ? `${talhao.nome} · ${s.area_semeada} ha` : undefined,
          color: 'hsl(210 100% 50%)',
        })
      }
    }

    for (const m of monitoramentos) {
      const d = m.data?.slice(0, 10)
      if (d && d >= from && d <= to && (m.severidade === 'severo' || m.severidade === 'critico')) {
        const talhao = talhaoMap.get(m.talhao_id)
        const agenteLabel = talhao
          ? getAgenteLabel(talhao.cultura as CulturaType, m.tipo === 'praga' ? 'praga' : 'doenca', m.agente)
          : m.agente
        all.push({
          id: m.id,
          type: 'monitoramento',
          date: d,
          label: `${m.severidade === 'critico' ? '🔴' : '🟠'} ${agenteLabel}`,
          sub: talhao ? talhao.nome : undefined,
          color: m.severidade === 'critico' ? 'hsl(0 72% 51%)' : 'hsl(25 90% 50%)',
        })
      }
    }

    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, maxItems)
  }, [aplicacoes, semeadurasEtapas, monitoramentos, talhaoMap, from, to, maxItems])

  const ICONS: Record<EventType, typeof FlaskConical> = {
    aplicacao:     FlaskConical,
    semeadura:     Sprout,
    monitoramento: Bug,
  }

  if (events.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13, padding: '24px 0' }}>Nenhum evento no período</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((ev, i) => {
        const Icon = ICONS[ev.type]
        const dateStr = (() => {
          try { return format(parseISO(ev.date), 'dd MMM', { locale: ptBR }) }
          catch { return ev.date }
        })()
        return (
          <div key={ev.id + i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < events.length - 1 ? '1px solid var(--borda)' : 'none' }}>
            <div style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 11, color: 'var(--fg-subtle)', paddingTop: 2 }}>{dateStr}</div>
            <div style={{ width: 2, alignSelf: 'stretch', background: 'var(--borda)', borderRadius: 1, flexShrink: 0 }} />
            <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: `${ev.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={12} color={ev.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{ev.label}</div>
              {ev.sub && <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{ev.sub}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
