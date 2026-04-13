'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { cn, formatDate } from '@/lib/utils'
import type { Notificacao } from '@/types'
import { Bell, BellOff, CheckCheck, AlertTriangle, Clock, Calendar, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

const notifConfig: Record<Notificacao['tipo'], { icon: React.ElementType; bg: string; color: string }> = {
  atrasado: { icon: AlertTriangle, bg: 'hsl(0 86% 97%)', color: 'hsl(0 72% 51%)' },
  hoje: { icon: Clock, bg: 'hsl(210 100% 97%)', color: 'hsl(210 100% 50%)' },
  amanha: { icon: Calendar, bg: 'hsl(45 100% 96%)', color: 'hsl(32 95% 44%)' },
  tres_dias: { icon: Calendar, bg: 'hsl(45 100% 96%)', color: 'hsl(32 95% 50%)' },
  semana: { icon: Info, bg: 'var(--verde-50)', color: 'var(--verde-500)' },
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
    <div className="px-4 py-6 md:px-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-start justify-between mb-8">
        <div>
          <p className="section-label mb-1">Notificações</p>
          <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--fg)' }}>
            Alertas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {unread > 0 ? `${unread} não lido${unread !== 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={marcarTodasLidas} className="gap-1.5 mt-1">
            <CheckCheck className="w-4 h-4" />
            Marcar todas lidas
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div
        className="animate-enter animate-enter-2 flex mb-6 p-1 rounded-xl"
        style={{ background: 'var(--bg-dark)' }}
      >
        {(['nao_lidas', 'todas'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltroLida(f)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition"
            style={{
              background: filtroLida === f ? 'var(--bg-card)' : 'transparent',
              color: filtroLida === f ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow: filtroLida === f ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {f === 'nao_lidas' ? `Não lidas${unread > 0 ? ` (${unread})` : ''}` : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card animate-enter animate-enter-3 p-14 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--bg-dark)' }}
          >
            <BellOff className="w-7 h-7" style={{ color: 'var(--fg-subtle)' }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>
            {filtroLida === 'nao_lidas' ? 'Nenhum alerta não lido' : 'Nenhum alerta'}
          </p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Você está em dia com todas as aplicações!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n, i) => {
            const cfg = notifConfig[n.tipo] || { icon: Bell, bg: 'var(--bg-dark)', color: 'var(--fg-muted)' }
            const Icon = cfg.icon
            return (
              <div
                key={n.id}
                onClick={() => !n.lida && marcarLida(n.id)}
                className={cn('card flex items-start gap-3 p-4 animate-enter', !n.lida && 'cursor-pointer')}
                style={{
                  opacity: n.lida ? 0.55 : 1,
                  animationDelay: `${(i + 2) * 50}ms`,
                  transition: 'opacity 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { if (!n.lida) e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm"
                    style={{ color: n.lida ? 'var(--fg-muted)' : 'var(--fg)', fontWeight: n.lida ? 400 : 500 }}
                  >
                    {n.mensagem}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                    {formatDate(n.data_referencia)}
                  </p>
                </div>
                {!n.lida && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: 'var(--verde-500)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
