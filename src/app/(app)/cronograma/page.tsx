'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select } from '@/components/ui/select'
import { diasParaProxima, culturaIcon, culturaLabel } from '@/lib/utils'
import type { Aplicacao, Fazenda, Talhao } from '@/types'
import { CalendarDays, ChevronLeft, ChevronRight, Sprout, CheckCircle2, FlaskConical } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, parseISO, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Event types ──────────────────────────────────────────────────────────────

type EventType = 'aplicacao' | 'plantio' | 'colheita'

interface CalendarEvent {
  id: string
  type: EventType
  date: string
  label: string
  status?: string
  talhaoNome?: string
  fazendaNome?: string
}

const statusColor: Record<string, string> = {
  atrasado:       'hsl(0 86% 95%)',
  hoje:           'hsl(210 100% 95%)',
  proximo:        'hsl(45 100% 93%)',
  dentro_do_prazo:'var(--verde-50)',
}
const statusTextColor: Record<string, string> = {
  atrasado:       'hsl(0 72% 45%)',
  hoje:           'hsl(210 100% 40%)',
  proximo:        'hsl(32 95% 40%)',
  dentro_do_prazo:'var(--verde-700)',
}
const eventTypeColor: Record<EventType, { bg: string; text: string }> = {
  aplicacao: { bg: 'hsl(270 60% 96%)', text: 'hsl(270 60% 45%)' },
  plantio:   { bg: 'hsl(130 55% 30% / 0.12)', text: 'hsl(130 55% 25%)' },
  colheita:  { bg: 'hsl(38 90% 93%)', text: 'hsl(32 90% 35%)' },
}
const eventTypeIcon: Record<EventType, React.ReactNode> = {
  aplicacao: <FlaskConical size={11} />,
  plantio:   <Sprout size={11} />,
  colheita:  <CheckCircle2 size={11} />,
}

export default function CronogramaPage() {
  const { user } = useAuthStore()
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [filtroFazenda, setFiltroFazenda] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'calendar' | 'timeline'>('calendar')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const fazs = await db.fazendas.where('usuario_id').equals(user.id).toArray()
      setFazendas(fazs)
      const fazIds = fazs.map(f => f.id)
      const tals = await db.talhoes.where('fazenda_id').anyOf(fazIds).toArray()
      setTalhoes(tals)
      const apps = await db.aplicacoes.where('usuario_id').equals(user.id).toArray()
      const enriched = await Promise.all(apps.map(async a => {
        const [talhao, produto] = await Promise.all([
          db.talhoes.get(a.talhao_id),
          db.produtos.get(a.produto_id),
        ])
        return { ...a, talhao, produto }
      }))
      setAplicacoes(enriched as Aplicacao[])
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // ── Build unified event list ─────────────────────────────────────────────

  const filteredAps = aplicacoes.filter(a =>
    !filtroFazenda || (a.talhao as any)?.fazenda_id === filtroFazenda
  )
  const filteredTalhoes = talhoes.filter(t =>
    !filtroFazenda || t.fazenda_id === filtroFazenda
  )

  const events: CalendarEvent[] = []

  // Aplicação events: use proxima_aplicacao for planejadas, data_aplicacao for realizadas
  for (const a of filteredAps) {
    const date = a.tipo === 'planejada' ? a.data_aplicacao : a.proxima_aplicacao
    const talhaoNome = (a.talhao as any)?.nome
    const fazendaId = (a.talhao as any)?.fazenda_id
    const fazendaNome = fazendas.find(f => f.id === fazendaId)?.nome
    events.push({
      id: `ap-${a.id}`,
      type: 'aplicacao',
      date,
      label: (a.produto as any)?.nome || 'Aplicação',
      status: a.status,
      talhaoNome,
      fazendaNome,
    })
  }

  // Plantio events
  for (const t of filteredTalhoes) {
    if (!t.data_plantio) continue
    const fazendaNome = fazendas.find(f => f.id === t.fazenda_id)?.nome
    events.push({
      id: `plantio-${t.id}`,
      type: 'plantio',
      date: t.data_plantio,
      label: `Plantio: ${t.nome}`,
      talhaoNome: t.nome,
      fazendaNome,
    })
  }

  // Colheita events
  for (const t of filteredTalhoes) {
    if (!t.data_colheita_prevista) continue
    const fazendaNome = fazendas.find(f => f.id === t.fazenda_id)?.nome
    events.push({
      id: `colheita-${t.id}`,
      type: 'colheita',
      date: t.data_colheita_prevista,
      label: `Colheita: ${t.nome}`,
      talhaoNome: t.nome,
      fazendaNome,
    })
  }

  const fazendaOptions = [
    { value: '', label: 'Todas as fazendas' },
    ...fazendas.map(f => ({ value: f.id, label: f.nome })),
  ]

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  function getEventsForDay(day: Date): CalendarEvent[] {
    return events.filter(ev => {
      try { return isSameDay(parseISO(ev.date), day) } catch { return false }
    })
  }

  const timeline = [...events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-center justify-between mb-8">
        <div>
          <p className="section-label mb-1">Planejamento</p>
          <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--fg)' }}>
            Cronograma
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Plantios, aplicações e colheitas de todas as fazendas
          </p>
        </div>
        <div className="flex items-center p-1 rounded-xl" style={{ background: 'var(--bg-dark)' }}>
          {(['calendar', 'timeline'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition"
              style={{
                background: view === v ? 'var(--bg-card)' : 'transparent',
                color: view === v ? 'var(--fg)' : 'var(--fg-muted)',
                boxShadow: view === v ? 'var(--shadow-xs)' : 'none',
              }}
            >
              {v === 'calendar' ? 'Calendário' : 'Timeline'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="animate-enter animate-enter-2 mb-6 max-w-xs">
        <Select value={filtroFazenda} onChange={e => setFiltroFazenda(e.target.value)} options={fazendaOptions} />
      </div>

      {view === 'calendar' ? (
        <div className="animate-enter animate-enter-3 card overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--borda)' }}>
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
              className="p-1.5 rounded-lg transition"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold capitalize" style={{ color: 'var(--fg)' }}>
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="p-1.5 rounded-lg transition"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--borda)' }}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="py-2.5 text-center">
                <span className="section-label" style={{ margin: 0 }}>{d}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px]"
                style={{ borderRight: '1px solid var(--borda)', borderBottom: '1px solid var(--borda)', background: 'var(--bg)' }} />
            ))}
            {days.map(day => {
              const dayEvs = getEventsForDay(day)
              const today = isToday(day)
              return (
                <div key={day.toISOString()} className="min-h-[80px] p-1.5"
                  style={{
                    borderRight: '1px solid var(--borda)',
                    borderBottom: '1px solid var(--borda)',
                    background: today ? 'hsl(160 84% 22% / 0.06)' : 'transparent',
                  }}
                >
                  <span
                    className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1"
                    style={{
                      // Fixed green circle for today — high contrast in both light/dark mode
                      background: today ? 'hsl(160 84% 22%)' : 'transparent',
                      color: today ? '#ffffff' : 'var(--fg-muted)',
                      fontWeight: today ? 700 : undefined,
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvs.slice(0, 3).map(ev => {
                      const tc = ev.type === 'aplicacao' && ev.status
                        ? { bg: statusColor[ev.status] || 'var(--bg-dark)', text: statusTextColor[ev.status] || 'var(--fg-muted)' }
                        : eventTypeColor[ev.type]
                      return (
                        <div key={ev.id} className="text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-0.5"
                          style={{ background: tc.bg, color: tc.text }}>
                          <span className="flex-shrink-0">{eventTypeIcon[ev.type]}</span>
                          <span className="truncate">{ev.label}</span>
                        </div>
                      )
                    })}
                    {dayEvs.length > 3 && (
                      <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>+{dayEvs.length - 3}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 flex-wrap" style={{ borderTop: '1px solid var(--borda)' }}>
            {([
              { label: 'Plantio', key: 'plantio' },
              { label: 'Aplicação', key: 'aplicacao' },
              { label: 'Colheita', key: 'colheita' },
              { label: 'Atrasado', key: 'atrasado' },
            ] as const).map(({ label, key }) => {
              const isStatus = key === 'atrasado'
              const bg = isStatus ? statusColor[key] : eventTypeColor[key as EventType].bg
              const border = isStatus ? statusTextColor[key] : eventTypeColor[key as EventType].text
              return (
                <span key={key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
                  <span className="w-3 h-3 rounded" style={{ background: bg, border: `1px solid ${border}` }} />
                  {label}
                </span>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="animate-enter animate-enter-3">
          {loading ? (
            <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
          ) : timeline.length === 0 ? (
            <div className="card p-14 text-center">
              <CalendarDays className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p style={{ color: 'var(--fg-muted)' }}>Nenhum evento no cronograma</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute top-0 bottom-0 w-px" style={{ left: '4rem', background: 'var(--borda)' }} />
              <div className="space-y-4">
                {timeline.map((ev, i) => {
                  const tc = ev.type === 'aplicacao' && ev.status
                    ? { bg: statusColor[ev.status] || 'var(--bg-dark)', text: statusTextColor[ev.status] || 'var(--fg-muted)' }
                    : eventTypeColor[ev.type]
                  const dias = (() => {
                    try {
                      const hoje = new Date(); hoje.setHours(0,0,0,0)
                      const d = parseISO(ev.date)
                      return Math.round((d.getTime() - hoje.getTime()) / 86400000)
                    } catch { return 0 }
                  })()
                  return (
                    <div key={ev.id} className="flex gap-4 relative animate-enter"
                      style={{ animationDelay: `${i * 35}ms` }}>
                      <div className="w-14 flex-shrink-0 text-right pt-1.5">
                        <div className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                          {format(parseISO(ev.date), 'dd/MM')}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {dias === 0 ? 'hoje' : dias > 0 ? `+${dias}d` : `${Math.abs(dias)}d atrás`}
                        </div>
                      </div>
                      <div className="w-3 h-3 rounded-full border-2 flex-shrink-0 mt-2 z-10"
                        style={{ background: 'var(--bg-card)', borderColor: tc.text }} />
                      <div className="flex-1 card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span style={{ color: tc.text }}>{eventTypeIcon[ev.type]}</span>
                              <div className="font-medium text-sm" style={{ color: 'var(--fg)' }}>
                                {ev.label}
                              </div>
                            </div>
                            {(ev.talhaoNome || ev.fazendaNome) && (
                              <div className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                                {ev.talhaoNome}{ev.fazendaNome ? ` · ${ev.fazendaNome}` : ''}
                              </div>
                            )}
                          </div>
                          {ev.type === 'aplicacao' && ev.status && (
                            <StatusBadge status={ev.status as any} />
                          )}
                          {ev.type !== 'aplicacao' && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ color: tc.text, background: tc.bg }}>
                              {ev.type === 'plantio' ? 'Plantio' : 'Colheita'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
