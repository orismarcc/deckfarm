'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { enqueueSync, processSyncQueue } from '@/lib/db/sync'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import type { Aplicacao, Fazenda, Talhao, SemeaduraEtapa } from '@/types'
import { CalendarDays, ChevronLeft, ChevronRight, Sprout, CheckCircle2, FlaskConical, Layers } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, parseISO, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string as LOCAL midnight — avoids timezone X-1 bug */
function localDate(dateStr: string): Date {
  const s = dateStr.split('T')[0]
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ── Event types ──────────────────────────────────────────────────────────────

type EventType = 'aplicacao' | 'plantio' | 'colheita' | 'semeadura'

interface CalendarEvent {
  id: string
  type: EventType
  date: string
  label: string
  status?: string
  detail?: string
  talhaoNome?: string
  fazendaNome?: string
  aplicacaoId?: string                       // raw DB id (no 'ap-' prefix)
  aplicacaoTipo?: 'planejada' | 'realizada'  // current tipo for toggle UI
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
  semeadura: { bg: 'hsl(210 100% 95%)', text: 'hsl(210 100% 35%)' },
}
const eventTypeIcon: Record<EventType, React.ReactNode> = {
  aplicacao: <FlaskConical size={11} />,
  plantio:   <Sprout size={11} />,
  colheita:  <CheckCircle2 size={11} />,
  semeadura: <Layers size={11} />,
}
const eventTypeLabel: Record<EventType, string> = {
  aplicacao: 'Aplicação',
  plantio:   'Plantio',
  colheita:  'Colheita',
  semeadura: 'Semeadura',
}

export default function CronogramaPage() {
  const { user } = useAuthStore()
  const { lastServerSyncAt } = useAppStore()
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [etapas, setEtapas] = useState<SemeaduraEtapa[]>([])
  const [filtroFazenda, setFiltroFazenda] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'calendar' | 'timeline'>('calendar')
  const [loading, setLoading] = useState(true)

  // Day detail modal
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null)
  const [dayModalEvents, setDayModalEvents] = useState<CalendarEvent[]>([])

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
      const apps = await db.aplicacoes.where('usuario_id').equals(user.id).filter(a => !a.deleted_at).toArray()
      const enriched = await Promise.all(apps.map(async a => {
        const [talhao, produto] = await Promise.all([
          db.talhoes.get(a.talhao_id),
          db.produtos.get(a.produto_id),
        ])
        return { ...a, talhao, produto }
      }))
      setAplicacoes(enriched as Aplicacao[])

      // Semeadura etapas
      const talIds = tals.map(t => t.id)
      const ets = talIds.length > 0
        ? await db.semeaduraEtapas.where('talhao_id').anyOf(talIds).toArray()
        : []
      setEtapas(ets)
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle aplicação tipo (planejada ↔ realizada) ────────────────────────
  async function toggleAplicacaoTipo(aplicacaoId: string, tipoAtual: 'planejada' | 'realizada') {
    const db = getDB()
    const novoTipo = tipoAtual === 'planejada' ? 'realizada' : 'planejada'
    const now = new Date().toISOString()
    await db.aplicacoes.update(aplicacaoId, { tipo: novoTipo, updatedAt: now, _syncStatus: 'pending' })
    const updated = await db.aplicacoes.get(aplicacaoId)
    if (updated) {
      await enqueueSync('aplicacao', 'upsert', updated as unknown as Record<string, unknown>)
      processSyncQueue()
    }
    setAplicacoes(prev => prev.map(a => a.id === aplicacaoId ? { ...a, tipo: novoTipo } : a))
  }

  // ── Build unified event list ─────────────────────────────────────────────

  const filteredAps = aplicacoes.filter(a =>
    !filtroFazenda || (a.talhao as any)?.fazenda_id === filtroFazenda
  )
  const filteredTalhoes = talhoes.filter(t =>
    !filtroFazenda || t.fazenda_id === filtroFazenda
  )
  const filteredEtapas = etapas.filter(e =>
    !filtroFazenda || e.fazenda_id === filtroFazenda
  )

  const events: CalendarEvent[] = []

  // Aplicação events: use data_aplicacao for planejadas (their scheduled date), data_aplicacao for realizadas
  for (const a of filteredAps) {
    const date = a.data_aplicacao
    const talhaoNome = (a.talhao as any)?.nome
    const fazendaId  = (a.talhao as any)?.fazenda_id
    const fazendaNome = fazendas.find(f => f.id === fazendaId)?.nome
    const prod = (a as any).produto
    events.push({
      id: `ap-${a.id}`,
      type: 'aplicacao',
      date,
      label: prod?.nome || 'Aplicação',
      status: a.status,
      detail: a.tipo === 'realizada' ? '✓ Realizada' : '📅 Agendada',
      talhaoNome,
      fazendaNome,
      aplicacaoId: a.id,
      aplicacaoTipo: a.tipo as 'planejada' | 'realizada',
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

  // Semeadura etapa events
  for (const e of filteredEtapas) {
    const talhao = talhoes.find(t => t.id === e.talhao_id)
    const fazendaNome = fazendas.find(f => f.id === e.fazenda_id)?.nome
    events.push({
      id: `sem-${e.id}`,
      type: 'semeadura',
      date: e.data_semeadura,
      label: `${e.etapa}ª Semeadura${talhao ? ` · ${talhao.nome}` : ''}`,
      detail: `${e.area_semeada} ha`,
      talhaoNome: talhao?.nome,
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
      try { return isSameDay(localDate(ev.date), day) } catch { return false }
    })
  }

  function openDayModal(day: Date) {
    const evs = getEventsForDay(day)
    if (evs.length === 0) return
    setDayModalDate(day)
    setDayModalEvents(evs)
  }

  // ── Timeline: rolling 30 days past → 90 days future ─────────────────────
  const timelineWindowStart = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 30); return d })()
  const timelineWindowEnd   = (() => { const d = new Date(); d.setHours(23,59,59,999); d.setDate(d.getDate() + 90); return d })()

  const timeline = [...events]
    .filter(ev => {
      try {
        const d = localDate(ev.date)
        return d >= timelineWindowStart && d <= timelineWindowEnd
      } catch { return false }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

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
            Plantios, semeaduras, aplicações e colheitas de todas as fazendas
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
              const clickable = dayEvs.length > 0
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] p-1.5 ${clickable ? 'cursor-pointer' : ''}`}
                  onClick={() => openDayModal(day)}
                  style={{
                    borderRight: '1px solid var(--borda)',
                    borderBottom: '1px solid var(--borda)',
                    background: today ? 'hsl(160 84% 22% / 0.06)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (clickable) e.currentTarget.style.background = today ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg-dark)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = today ? 'hsl(160 84% 22% / 0.06)' : 'transparent' }}
                >
                  <span
                    className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1"
                    style={{
                      background: today ? 'hsl(160 84% 22%)' : 'transparent',
                      color: today ? '#ffffff' : 'var(--fg-muted)',
                      fontWeight: today ? 700 : undefined,
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvs.slice(0, 3).map(ev => {
                      const tc = ev.type === 'aplicacao'
                        ? ev.aplicacaoTipo === 'realizada'
                          ? { bg: 'hsl(160 84% 22% / 0.1)', text: 'hsl(160 84% 22%)' }
                          : { bg: statusColor[ev.status || ''] || 'var(--bg-dark)', text: statusTextColor[ev.status || ''] || 'var(--fg-muted)' }
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
                      <div className="text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>+{dayEvs.length - 3} mais</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 flex-wrap" style={{ borderTop: '1px solid var(--borda)' }}>
            {([
              { label: 'Plantio',   key: 'plantio' },
              { label: 'Semeadura', key: 'semeadura' },
              { label: 'Aplicação', key: 'aplicacao' },
              { label: 'Colheita',  key: 'colheita' },
              { label: 'Atrasado',  key: 'atrasado' },
            ] as const).map(({ label, key }) => {
              const isStatus = key === 'atrasado'
              const bg     = isStatus ? statusColor[key] : eventTypeColor[key as EventType].bg
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
        /* ── Timeline ─── */
        <div className="animate-enter animate-enter-3 overflow-x-hidden">
          {loading ? (
            <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
          ) : timeline.length === 0 ? (
            <div className="card p-14 text-center">
              <CalendarDays className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p style={{ color: 'var(--fg-muted)' }}>Nenhum evento no período (últimos 30 dias + próximos 90 dias)</p>
            </div>
          ) : (
            <div className="relative overflow-hidden">
              <div className="absolute top-0 bottom-0 w-px" style={{ left: '3.5rem', background: 'var(--borda)' }} />
              <div className="space-y-3">
                {timeline.map((ev, i) => {
                  // Realizadas always show green; planejadas use status color
                  const tc = ev.type === 'aplicacao'
                    ? ev.aplicacaoTipo === 'realizada'
                      ? { bg: 'hsl(160 84% 22% / 0.1)', text: 'hsl(160 84% 22%)' }
                      : { bg: statusColor[ev.status || ''] || 'var(--bg-dark)', text: statusTextColor[ev.status || ''] || 'var(--fg-muted)' }
                    : eventTypeColor[ev.type]
                  const evDate = localDate(ev.date)
                  const hoje = new Date(); hoje.setHours(0,0,0,0)
                  const dias = Math.round((evDate.getTime() - hoje.getTime()) / 86400000)

                  return (
                    <div key={ev.id} className="flex gap-3 relative animate-enter min-w-0"
                      style={{ animationDelay: `${i * 35}ms` }}>
                      {/* Date column */}
                      <div className="w-14 flex-shrink-0 text-right pt-1.5">
                        <div className="text-xs font-semibold leading-tight" style={{ color: 'var(--fg)' }}>
                          {format(evDate, 'dd/MM')}
                        </div>
                        <div className="text-[10px] leading-tight" style={{ color: 'var(--fg-subtle)' }}>
                          {dias === 0 ? 'hoje' : dias > 0 ? `+${dias}d` : `${Math.abs(dias)}d atrás`}
                        </div>
                      </div>
                      {/* Timeline dot */}
                      <div className="w-3 h-3 rounded-full border-2 flex-shrink-0 mt-2 z-10"
                        style={{
                          background: ev.aplicacaoTipo === 'realizada' ? 'hsl(160 84% 22%)' : 'var(--bg-card)',
                          borderColor: tc.text,
                        }} />
                      {/* Card */}
                      <div className="flex-1 min-w-0 card p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="flex-shrink-0" style={{ color: tc.text }}>{eventTypeIcon[ev.type]}</span>
                              <div className="font-medium text-sm truncate" style={{ color: 'var(--fg)' }}>
                                {ev.label}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {(ev.talhaoNome || ev.fazendaNome) && (
                                <span className="text-xs truncate" style={{ color: 'var(--fg-muted)' }}>
                                  {ev.talhaoNome}{ev.fazendaNome ? ` · ${ev.fazendaNome}` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: status badge + toggle button */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                            {ev.type === 'aplicacao' ? (
                              ev.aplicacaoTipo === 'realizada' ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                                  style={{ background: 'hsl(160 84% 22% / 0.12)', color: 'hsl(160 84% 22%)' }}>
                                  <CheckCircle2 size={9} /> Realizada
                                </span>
                              ) : (
                                <StatusBadge status={ev.status as any} />
                              )
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ color: tc.text, background: tc.bg }}>
                                {eventTypeLabel[ev.type]}
                              </span>
                            )}

                            {/* Toggle: only for aplicacao events */}
                            {ev.type === 'aplicacao' && ev.aplicacaoId && (
                              <button
                                type="button"
                                onClick={() => toggleAplicacaoTipo(ev.aplicacaoId!, ev.aplicacaoTipo!)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all"
                                style={{
                                  borderColor: ev.aplicacaoTipo === 'realizada'
                                    ? 'hsl(0 60% 60% / 0.35)'
                                    : 'hsl(160 84% 22% / 0.35)',
                                  color: ev.aplicacaoTipo === 'realizada'
                                    ? 'hsl(0 60% 50%)'
                                    : 'hsl(160 84% 22%)',
                                  background: 'transparent',
                                }}
                              >
                                {ev.aplicacaoTipo === 'realizada' ? '↩ Reverter' : '✓ Realizar'}
                              </button>
                            )}
                          </div>
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

      {/* ── Day detail modal ── */}
      <Modal
        open={!!dayModalDate}
        onClose={() => setDayModalDate(null)}
        title={dayModalDate ? format(dayModalDate, "dd 'de' MMMM yyyy", { locale: ptBR }) : ''}
      >
        <div className="space-y-2">
          {dayModalEvents.map(ev => {
            const tc = ev.type === 'aplicacao'
              ? ev.aplicacaoTipo === 'realizada'
                ? { bg: 'hsl(160 84% 22% / 0.1)', text: 'hsl(160 84% 22%)' }
                : { bg: statusColor[ev.status || ''] || 'var(--bg-dark)', text: statusTextColor[ev.status || ''] || 'var(--fg-muted)' }
              : eventTypeColor[ev.type]
            return (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: tc.bg, border: `1px solid ${tc.text}22` }}>
                <span className="mt-0.5 flex-shrink-0" style={{ color: tc.text }}>{eventTypeIcon[ev.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: tc.text }}>{ev.label}</p>
                  {(ev.talhaoNome || ev.fazendaNome) && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                      {ev.talhaoNome}{ev.fazendaNome ? ` · ${ev.fazendaNome}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'white', color: tc.text }}>
                    {ev.type === 'aplicacao'
                      ? (ev.aplicacaoTipo === 'realizada' ? 'Realizada' : 'Agendada')
                      : eventTypeLabel[ev.type]}
                  </span>
                  {ev.type === 'aplicacao' && ev.aplicacaoId && (
                    <button
                      type="button"
                      onClick={() => toggleAplicacaoTipo(ev.aplicacaoId!, ev.aplicacaoTipo!)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all"
                      style={{
                        borderColor: ev.aplicacaoTipo === 'realizada'
                          ? 'hsl(0 60% 60% / 0.4)'
                          : 'hsl(160 84% 22% / 0.4)',
                        color: ev.aplicacaoTipo === 'realizada'
                          ? 'hsl(0 60% 50%)'
                          : 'hsl(160 84% 22%)',
                        background: 'transparent',
                      }}
                    >
                      {ev.aplicacaoTipo === 'realizada' ? '↩ Reverter' : '✓ Realizar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
