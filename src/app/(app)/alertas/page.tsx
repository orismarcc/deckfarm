'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { cn, formatDate } from '@/lib/utils'
import { gerarAlertasAutomaticos } from '@/lib/db/agronomo'
import type { Notificacao } from '@/types'
import { Bell, BellOff, CheckCheck, AlertTriangle, Clock, Calendar, Info, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const notifConfig: Record<Notificacao['tipo'], { icon: React.ElementType; color: string; bg: string }> = {
  atrasado: { icon: AlertTriangle, color: 'hsl(4 72% 50%)',    bg: 'hsl(4 86% 96%)' },
  hoje:     { icon: Clock,         color: 'hsl(210 100% 45%)', bg: 'hsl(210 100% 96%)' },
  amanha:   { icon: Calendar,      color: 'hsl(38 70% 38%)',   bg: 'hsl(38 92% 95%)' },
  tres_dias:{ icon: Calendar,      color: 'hsl(38 70% 42%)',   bg: 'hsl(38 92% 95%)' },
  semana:   { icon: Info,          color: 'hsl(160 84% 22%)',  bg: 'hsl(160 84% 96%)' },
}

export default function AlertasPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { notificacoes, setNotificacoes, markNotificacaoLida, lastServerSyncAt } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [filtroLida, setFiltroLida] = useState<'nao_lidas' | 'todas'>('nao_lidas')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      await gerarAlertasAutomaticos(user.id)
      const db = getDB()
      const today = new Date().toISOString().split('T')[0]
      const nots = await db.notificacoes
        .where('usuario_id').equals(user.id)
        .and(n => n.data_referencia <= today)
        .reverse().sortBy('data_referencia')
      setNotificacoes(nots)
    } finally { setLoading(false) }
  }, [user, setNotificacoes])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarLida(id: string) {
    await getDB().notificacoes.update(id, { lida: true })
    markNotificacaoLida(id)
  }

  async function marcarTodasLidas() {
    const naoLidas = notificacoes.filter(n => !n.lida)
    await Promise.all(naoLidas.map(n => getDB().notificacoes.update(n.id, { lida: true })))
    naoLidas.forEach(n => markNotificacaoLida(n.id))
  }

  async function handleClickAlerta(n: Notificacao) {
    // Mark as read
    if (!n.lida) await marcarLida(n.id)

    // Navigate to the relevant resource
    if (n.talhao_id) {
      router.push(`/talhoes/${n.talhao_id}`)
    } else if (n.fazenda_id) {
      router.push(`/fazendas/${n.fazenda_id}`)
    }
  }

  const unread = notificacoes.filter(n => !n.lida).length
  const filtered = notificacoes.filter(n => filtroLida === 'todas' || !n.lida)

  return (
    <div className="px-4 py-6 md:px-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="animate-enter-1 flex items-start justify-between mb-8">
        <div>
          <p className="section-label mb-1">Notificações</p>
          <h1 className="font-display text-[2rem] font-bold" style={{ color: 'var(--fg)' }}>Alertas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {unread > 0 ? `${unread} não lido${unread !== 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={marcarTodasLidas} className="gap-1.5 mt-1">
            <CheckCheck size={14} /> Marcar todas lidas
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="animate-enter-2 flex mb-6 p-1 rounded-xl" style={{ background: 'var(--bg-dark)' }}>
        {(['nao_lidas', 'todas'] as const).map(f => (
          <button key={f} onClick={() => setFiltroLida(f)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
            style={{
              background: filtroLida === f ? 'var(--bg-card)' : 'transparent',
              color: filtroLida === f ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow: filtroLida === f ? 'var(--shadow-xs)' : 'none',
            }}>
            {f === 'nao_lidas' ? `Não lidas${unread > 0 ? ` (${unread})` : ''}` : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card animate-enter-3 p-14 text-center">
          <div className="icon-circle icon-circle-muted w-14 h-14 mx-auto mb-4"><BellOff size={22} /></div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>
            {filtroLida === 'nao_lidas' ? 'Nenhum alerta não lido' : 'Nenhum alerta'}
          </p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Você está em dia com todas as aplicações!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n, i) => {
            const cfg = notifConfig[n.tipo] || { icon: Bell, color: 'var(--fg-muted)', bg: 'var(--bg-dark)' }
            const Icon = cfg.icon
            const isNavigable = !!(n.talhao_id || n.fazenda_id)
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClickAlerta(n)}
                className={cn(
                  'card w-full text-left flex items-start gap-3 p-4 animate-enter transition-all',
                  isNavigable && 'cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5',
                  !isNavigable && 'cursor-default',
                )}
                style={{ opacity: n.lida ? 0.55 : 1, animationDelay: `${(i + 2) * 45}ms` }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg }}>
                  <Icon size={15} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed"
                    style={{ color: n.lida ? 'var(--fg-muted)' : 'var(--fg)', fontWeight: n.lida ? 400 : 500 }}>
                    {n.mensagem}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{formatDate(n.data_referencia)}</p>
                    {isNavigable && (
                      <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                        {n.talhao_id ? 'Ver talhão' : 'Ver fazenda'} →
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!n.lida && (
                    <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(160 84% 22%)' }} />
                  )}
                  {isNavigable && (
                    <ChevronRight size={14} style={{ color: 'var(--fg-subtle)' }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
