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
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cronograma</h1>
          <p className="text-gray-500 text-sm">Visualize e planeje as próximas aplicações</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setView('calendar')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition',
              view === 'calendar' ? 'bg-white shadow text-gray-900' : 'text-gray-500')}
          >
            Calendário
          </button>
          <button
            onClick={() => setView('timeline')}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition',
              view === 'timeline' ? 'bg-white shadow text-gray-900' : 'text-gray-500')}
          >
            Timeline
          </button>
        </div>
      </div>

      <div className="mb-5 max-w-xs">
        <Select value={filtroFazenda} onChange={e => setFiltroFazenda(e.target.value)} options={fazendaOptions} />
      </div>

      {view === 'calendar' ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-gray-900 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50 bg-gray-50/50" />
            ))}
            {days.map(day => {
              const dayApps = getAplicacoesForDay(day)
              const today = isToday(day)
              return (
                <div
                  key={day.toISOString()}
                  className={cn('min-h-[80px] border-r border-b border-gray-100 p-1.5', today && 'bg-green-50')}
                >
                  <span className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                    today ? 'bg-green-600 text-white' : 'text-gray-600'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayApps.slice(0, 3).map(a => (
                      <div
                        key={a.id}
                        className={cn('text-xs px-1.5 py-0.5 rounded truncate',
                          a.status === 'atrasado' ? 'bg-red-100 text-red-700' :
                          a.status === 'hoje' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'proximo' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        )}
                      >
                        {(a.produto as any)?.nome || 'App.'}
                      </div>
                    ))}
                    {dayApps.length > 3 && (
                      <div className="text-xs text-gray-400">+{dayApps.length - 3}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200" />No prazo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />Próximo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />Hoje</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" />Atrasado</span>
          </div>
        </div>
      ) : (
        /* Timeline view */
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma aplicação no cronograma</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-16 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {timeline.map(a => {
                  const dias = diasParaProxima(a.proxima_aplicacao)
                  return (
                    <div key={a.id} className="flex gap-4 relative">
                      <div className="w-14 flex-shrink-0 text-right pt-1.5">
                        <div className="text-xs font-medium text-gray-600">
                          {format(parseISO(a.proxima_aplicacao), 'dd/MM')}
                        </div>
                        <div className="text-xs text-gray-400">
                          {dias === 0 ? 'hoje' : dias > 0 ? `+${dias}d` : `${Math.abs(dias)}d atrás`}
                        </div>
                      </div>
                      <div className={cn(
                        'w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 mt-2 z-10',
                        a.status === 'atrasado' ? 'border-red-500' :
                        a.status === 'hoje' ? 'border-blue-500' :
                        a.status === 'proximo' ? 'border-yellow-500' :
                        'border-green-500'
                      )} />
                      <div className="flex-1 bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-gray-900 text-sm">
                              {(a.produto as any)?.nome || 'Produto'}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
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
