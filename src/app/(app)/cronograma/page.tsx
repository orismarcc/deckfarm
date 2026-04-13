'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { StatusBadge } from '@/components/ui/status-badge'
import { Select } from '@/components/ui/select'
import { cn, diasParaProxima, culturaIcon, culturaLabel } from '@/lib/utils'
import type { Aplicacao, Fazenda } from '@/types'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, parseISO, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const statusColor: Record<string, string> = {
  atrasado: 'hsl(0 86% 95%)',
  hoje: 'hsl(210 100% 95%)',
  proximo: 'hsl(45 100% 93%)',
  dentro_do_prazo: 'var(--verde-50)',
}
const statusTextColor: Record<string, string> = {
  atrasado: 'hsl(0 72% 45%)',
  hoje: 'hsl(210 100% 40%)',
  proximo: 'hsl(32 95% 40%)',
  dentro_do_prazo: 'var(--verde-700)',
}

export default function CronogramaPage() {
  const { user } = useAuthStore()
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
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

  const filtered = aplicacoes.filter(a => {
    if (filtroFazenda && (a.talhao as any)?.fazenda_id !== filtroFazenda) return false
    return true
  })

  const fazendaOptions = [
    { value: '', label: 'Todas as fazendas' },
    ...fazendas.map(f => ({ value: f.id, label: f.nome })),
  ]

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  function getAplicacoesForDay(day: Date) {
    return filtered.filter(a => {
      try { return isSameDay(parseISO(a.proxima_aplicacao), day) } catch { return false }
    })
  }

  const timeline = [...filtered].sort((a, b) =>
    a.proxima_aplicacao.localeCompare(b.proxima_aplicacao)
  )

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
            Visualize e planeje as próximas aplicações
          </p>
        </div>
        <div
          className="flex items-center p-1 rounded-xl"
          style={{ background: 'var(--bg-dark)' }}
        >
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
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--borda)' }}
          >
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
              <div
                key={d}
                className="py-2.5 text-center"
              >
                <span className="section-label" style={{ margin: 0 }}>{d}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[80px]"
                style={{
                  borderRight: '1px solid var(--borda)',
                  borderBottom: '1px solid var(--borda)',
                  background: 'var(--bg)',
                }}
              />
            ))}
            {days.map(day => {
              const dayApps = getAplicacoesForDay(day)
              const today = isToday(day)
              return (
                <div
                  key={day.toISOString()}
                  className="min-h-[80px] p-1.5"
                  style={{
                    borderRight: '1px solid var(--borda)',
                    borderBottom: '1px solid var(--borda)',
                    background: today ? 'var(--verde-50)' : 'transparent',
                  }}
                >
                  <span
                    className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1"
                    style={{
                      background: today ? 'var(--primary)' : 'transparent',
                      color: today ? '#fff' : 'var(--fg-muted)',
                    }}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayApps.slice(0, 3).map(a => (
                      <div
                        key={a.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate"
                        style={{
                          background: statusColor[a.status] || 'var(--bg-dark)',
                          color: statusTextColor[a.status] || 'var(--fg-muted)',
                        }}
                      >
                        {(a.produto as any)?.nome || 'App.'}
                      </div>
                    ))}
                    {dayApps.length > 3 && (
                      <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>+{dayApps.length - 3}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div
            className="flex items-center gap-4 px-5 py-3 flex-wrap"
            style={{ borderTop: '1px solid var(--borda)' }}
          >
            {[
              { label: 'No prazo', key: 'dentro_do_prazo' },
              { label: 'Próximo', key: 'proximo' },
              { label: 'Hoje', key: 'hoje' },
              { label: 'Atrasado', key: 'atrasado' },
            ].map(({ label, key }) => (
              <span key={key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
                <span
                  className="w-3 h-3 rounded"
                  style={{ background: statusColor[key], border: `1px solid ${statusTextColor[key]}` }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-enter animate-enter-3">
          {loading ? (
            <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
          ) : timeline.length === 0 ? (
            <div className="card p-14 text-center">
              <CalendarDays className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p style={{ color: 'var(--fg-muted)' }}>Nenhuma aplicação no cronograma</p>
            </div>
          ) : (
            <div className="relative">
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: '4rem', background: 'var(--borda)' }}
              />
              <div className="space-y-4">
                {timeline.map((a, i) => {
                  const dias = diasParaProxima(a.proxima_aplicacao)
                  return (
                    <div
                      key={a.id}
                      className="flex gap-4 relative animate-enter"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="w-14 flex-shrink-0 text-right pt-1.5">
                        <div className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                          {format(parseISO(a.proxima_aplicacao), 'dd/MM')}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {dias === 0 ? 'hoje' : dias > 0 ? `+${dias}d` : `${Math.abs(dias)}d atrás`}
                        </div>
                      </div>
                      <div
                        className="w-3 h-3 rounded-full border-2 flex-shrink-0 mt-2 z-10"
                        style={{
                          background: 'var(--bg-card)',
                          borderColor: statusTextColor[a.status] || 'var(--fg-subtle)',
                        }}
                      />
                      <div
                        className="flex-1 card p-3 transition"
                        style={{ flex: 1 }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm" style={{ color: 'var(--fg)' }}>
                              {(a.produto as any)?.nome || 'Produto'}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                              {(a.talhao as any)?.nome} · {culturaIcon((a.talhao as any)?.cultura)} {culturaLabel((a.talhao as any)?.cultura)}
                            </div>
                          </div>
                          <StatusBadge status={a.status} />
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
