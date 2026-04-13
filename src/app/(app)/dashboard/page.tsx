'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { getDashboardStats } from '@/lib/db/aplicacoes'
import { StatCard } from '@/components/dashboard/stat-card'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import type { Aplicacao } from '@/types'
import {
  AlertTriangle, Clock, CheckCircle2, Calendar, MapPin, Leaf, Plus,
  ChevronRight, RefreshCw, Sprout, TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { stats, setStats, fazendas, setFazendas, talhoes, setTalhoes, aplicacoes, setAplicacoes, setNotificacoes } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [urgentes, setUrgentes] = useState<Aplicacao[]>([])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const [fazs, tals, apps, nots] = await Promise.all([
        db.fazendas.where('usuario_id').equals(user.id).toArray(),
        db.talhoes.toArray(),
        db.aplicacoes.where('usuario_id').equals(user.id).toArray(),
        db.notificacoes.where('usuario_id').equals(user.id).toArray(),
      ])
      setFazendas(fazs)
      setTalhoes(tals)
      setAplicacoes(apps)
      setNotificacoes(nots)

      const s = await getDashboardStats(user.id)
      setStats(s)

      const urg = apps.filter(a => a.status === 'hoje' || a.status === 'atrasado' || a.status === 'proximo')
      const enriched = await Promise.all(urg.map(async (a) => {
        const [talhao, produto] = await Promise.all([
          db.talhoes.get(a.talhao_id),
          db.produtos.get(a.produto_id),
        ])
        return { ...a, talhao, produto }
      }))
      setUrgentes(enriched.slice(0, 6) as Aplicacao[])
    } finally {
      setLoading(false)
    }
  }, [user, setStats, setFazendas, setTalhoes, setAplicacoes, setNotificacoes])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3" style={{ color: 'var(--fg-subtle)' }}>
          <RefreshCw className="w-7 h-7 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    )
  }

  const hasData = (stats?.total_fazendas || 0) > 0
  const firstName = user?.nome?.split(' ')[0]

  return (
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto space-y-8">
      {/* Hero header */}
      <div className="animate-enter animate-enter-1 flex items-start justify-between">
        <div>
          <p className="section-label mb-1">Bem-vindo de volta</p>
          <h1
            className="font-display text-3xl font-bold"
            style={{ color: 'var(--fg)' }}
          >
            {firstName}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-xl transition"
          style={{ border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!hasData ? (
        /* Empty state */
        <div className="card animate-enter animate-enter-2 p-10 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--verde-50)' }}
          >
            <Sprout className="w-10 h-10" style={{ color: 'var(--verde-500)' }} />
          </div>
          <h2
            className="font-display text-2xl font-bold mb-2"
            style={{ color: 'var(--fg)' }}
          >
            Bem-vindo ao DeckFarm
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--fg-muted)' }}>
            Comece cadastrando sua primeira fazenda para gerenciar talhões e aplicações agrícolas.
          </p>
          <Link href="/fazendas">
            <Button size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar Fazenda
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="animate-enter animate-enter-2">
              <StatCard label="Atrasadas" value={stats?.atrasadas || 0} icon={AlertTriangle} variant="danger" description="Requerem atenção" />
            </div>
            <div className="animate-enter animate-enter-3">
              <StatCard label="Hoje" value={stats?.hoje || 0} icon={Clock} variant="info" description="Fazer agora" />
            </div>
            <div className="animate-enter animate-enter-4">
              <StatCard label="Esta semana" value={stats?.proximas || 0} icon={Calendar} variant="warning" description="Em até 7 dias" />
            </div>
            <div className="animate-enter animate-enter-5">
              <StatCard label="No prazo" value={stats?.dentro_prazo || 0} icon={CheckCircle2} variant="success" description="Sob controle" />
            </div>
          </div>

          {/* Farm overview chips */}
          <div className="animate-enter animate-enter-3 flex flex-wrap gap-3">
            {[
              { icon: MapPin, value: stats?.total_fazendas, label: 'Fazendas' },
              { icon: Leaf, value: stats?.total_talhoes, label: 'Talhões' },
              { icon: TrendingUp, value: stats?.total_aplicacoes, label: 'Aplicações' },
            ].map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--borda)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--verde-50)' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: 'var(--verde-500)' }} />
                </div>
                <span className="text-base font-bold" style={{ color: 'var(--fg)' }}>{value}</span>
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Alert banner */}
          {(stats?.atrasadas || 0) > 0 && (
            <div
              className="animate-enter animate-enter-3 flex items-start gap-3 p-4 rounded-2xl"
              style={{
                background: 'hsl(0 86% 97%)',
                border: '1px solid hsl(0 86% 90%)',
              }}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(0 72% 51%)' }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: 'hsl(0 72% 35%)' }}>
                  Atenção do Assistente Agronômico
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'hsl(0 72% 45%)' }}>
                  Você tem <strong>{stats?.atrasadas}</strong> aplicação{stats?.atrasadas !== 1 ? 'ões' : ''} atrasada{stats?.atrasadas !== 1 ? 's' : ''}. Regularize o manejo o quanto antes.
                </p>
              </div>
              <Link href="/aplicacoes" className="ml-auto flex-shrink-0">
                <span className="text-xs font-semibold" style={{ color: 'hsl(0 72% 51%)' }}>
                  Ver →
                </span>
              </Link>
            </div>
          )}

          {/* Urgentes */}
          {urgentes.length > 0 && (
            <div className="animate-enter animate-enter-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-label mb-0.5">Prioridade</p>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Requer Atenção</h2>
                </div>
                <Link href="/aplicacoes" className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--primary)' }}>
                  Ver todas <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {urgentes.map(a => <AplicacaoCard key={a.id} aplicacao={a} />)}
              </div>
            </div>
          )}

          {/* Fazendas */}
          {fazendas.length > 0 && (
            <div className="animate-enter animate-enter-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-label mb-0.5">Propriedades</p>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Suas Fazendas</h2>
                </div>
                <Link href="/fazendas" className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--primary)' }}>
                  Gerenciar <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fazendas.map(f => {
                  const talhoesF = talhoes.filter(t => t.fazenda_id === f.id)
                  const appsF = aplicacoes.filter(a => talhoesF.some(t => t.id === a.talhao_id))
                  const atrasadas = appsF.filter(a => a.status === 'atrasado').length
                  return (
                    <Link key={f.id} href={`/fazendas/${f.id}`}>
                      <div className="card card-interactive p-5 cursor-pointer">
                        <div className="flex items-start justify-between mb-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--verde-50)' }}
                          >
                            <MapPin className="w-5 h-5" style={{ color: 'var(--verde-500)' }} />
                          </div>
                          {atrasadas > 0 && (
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'hsl(0 86% 95%)', color: 'hsl(0 72% 45%)' }}
                            >
                              {atrasadas} atras.
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold mb-0.5" style={{ color: 'var(--fg)' }}>{f.nome}</h3>
                        <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>{f.localizacao}</p>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          <span className="flex items-center gap-1">
                            <Leaf className="w-3 h-3" />{talhoesF.length} talhões
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />{appsF.length} aplicações
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
