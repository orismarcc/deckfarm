'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { cn, formatDate } from '@/lib/utils'
import type { Notificacao } from '@/types'
import { Bell, BellOff, CheckCheck, AlertTriangle, Clock, Calendar, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

function NotifIcon({ tipo }: { tipo: Notificacao['tipo'] }) {
  const map: Record<Notificacao['tipo'], React.ReactNode> = {
    atrasado: <AlertTriangle className="w-5 h-5 text-red-500" />,
    hoje: <Clock className="w-5 h-5 text-blue-500" />,
    amanha: <Calendar className="w-5 h-5 text-yellow-500" />,
    tres_dias: <Calendar className="w-5 h-5 text-yellow-400" />,
    semana: <Info className="w-5 h-5 text-green-500" />,
  }
  return <>{map[tipo] || <Bell className="w-5 h-5 text-gray-400" />}</>
}

function notifBg(tipo: Notificacao['tipo']): string {
  const map: Record<Notificacao['tipo'], string> = {
    atrasado: 'bg-red-50',
    hoje: 'bg-blue-50',
    amanha: 'bg-yellow-50',
    tres_dias: 'bg-yellow-50',
    semana: 'bg-green-50',
  }
  return map[tipo] || 'bg-gray-50'
}

export default function AlertasPage() {
  const { user } = useAuthStore()
  const { notificacoes, setNotificacoes, markNotificacaoLida } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [filtroLida, setFiltroLida] = useState<'nao_lidas' | 'todas'>('nao_lidas')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const today = new Date().toISOString().split('T')[0]
      const nots = await db.notificacoes
        .where('usuario_id').equals(user.id)
        .and(n => n.data_referencia <= today)
        .reverse()
        .sortBy('data_referencia')
      setNotificacoes(nots)
    } finally { setLoading(false) }
  }, [user, setNotificacoes])

  useEffect(() => { loadData() }, [loadData])

  async function marcarLida(id: string) {
    const db = getDB()
    await db.notificacoes.update(id, { lida: true })
    markNotificacaoLida(id)
  }

  async function marcarTodasLidas() {
    const db = getDB()
    const naoLidas = notificacoes.filter(n => !n.lida)
    await Promise.all(naoLidas.map(n => db.notificacoes.update(n.id, { lida: true })))
    naoLidas.forEach(n => markNotificacaoLida(n.id))
  }

  const unread = notificacoes.filter(n => !n.lida).length
  const filtered = notificacoes.filter(n => filtroLida === 'todas' || !n.lida)

  return (
    <div className="px-4 py-6 md:px-8 max-w-2xl mx-auto animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          <p className="text-gray-500 text-sm">{unread} não lido{unread !== 1 ? 's' : ''}</p>
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={marcarTodasLidas} className="gap-1.5 text-gray-600">
            <CheckCheck className="w-4 h-4" />Marcar todas lidas
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(['nao_lidas', 'todas'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltroLida(f)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition',
              filtroLida === f ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            )}
          >
            {f === 'nao_lidas' ? `Não lidas (${unread})` : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BellOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">
            {filtroLida === 'nao_lidas' ? 'Nenhum alerta não lido' : 'Nenhum alerta'}
          </p>
          <p className="text-sm mt-1">Você está em dia com todas as aplicações!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div
              key={n.id}
              onClick={() => !n.lida && marcarLida(n.id)}
              className={cn(
                'bg-white rounded-xl border p-4 flex items-start gap-3 transition-all',
                n.lida
                  ? 'border-gray-100 opacity-60'
                  : 'border-gray-200 hover:border-green-200 hover:shadow-sm cursor-pointer'
              )}
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', notifBg(n.tipo))}>
                <NotifIcon tipo={n.tipo} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', n.lida ? 'text-gray-500' : 'text-gray-900 font-medium')}>
                  {n.mensagem}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.data_referencia)}</p>
              </div>
              {!n.lida && (
                <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
