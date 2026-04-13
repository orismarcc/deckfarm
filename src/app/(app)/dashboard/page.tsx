'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { getDashboardStats } from '@/lib/db/aplicacoes'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import type { Aplicacao } from '@/types'
import {
  AlertTriangle, Clock, CheckCircle2, Calendar, MapPin, Leaf, Plus,
  ChevronRight, RefreshCw, Sprout, TrendingUp, BarChart3
} from 'lucide-react'
import Link from 'next/link'

interface StatProps { label: string; value: number; icon: React.ElementType; color: string; bg: string; border: string }
function StatCard({ label, value, icon: Icon, color, bg, border }: StatProps) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="icon-sq w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-[1.75rem] font-bold leading-none" style={{ color: 'var(--fg)' }}>{value}</span>
      </div>
      <div>
        <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--fg-muted)' }}>{label}</p>
      </div>
      {/* accent bar */}
      <div className="h-[3px] rounded-full" style={{ background: border, opacity: 0.35 }} />
    </div>
  )
}

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
      setFazendas(fazs); setTalhoes(tals); setAplicacoes(apps); setNotificacoes(nots)
      const s = await getDashboardStats(user.id)
      setStats(s)
      const urg = apps.filter(a => a.status === 'hoje' || a.status === 'atrasado' || a.status === 'proximo')
      const enriched = await Promise.all(urg.map(async (a) => {
        const [talhao, produto] = await Promise.all([db.talhoes.get(a.talhao_id), db.produtos.get(a.produto_id)])
        return { ...a, talhao, produto }
      }))
      setUrgentes(enriched.slice(0, 6) as Aplicacao[])
    } finally { setLoading(false) }
  }, [user, setStats, setFazendas, setTalhoes, setAplicacoes, setNotificacoes])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3" style={{ color: 'var(--fg-subtle)' }}>
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    )
  }

  const hasData = (stats?.total_fazendas || 0) > 0
  const firstName = user?.nome?.split(' ')[0]
  const hora = new Date().getHours()
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto">

      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="animate-enter-1 flex items-start justify-between mb-8">
        <div>
          <p className="section-label mb-1">{greeting}</p>
          <h1 className="font-display text-[2rem] font-bold leading-tight" style={{ color: 'var(--fg)' }}>
            {firstName}
          </h1>
          <p className="text-sm mt-1 capitalize" style={{ color: 'var(--fg-muted)' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={loadData}
          className="mt-1 p-2 rounded-xl transition"
          style={{ border: '1.5px solid var(--borda)', color: 'var(--fg-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="Atualizar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {!hasData ? (
        /* ── Empty state ─── */
        <div className="card animate-enter-2 p-12 text-center max-w-md mx-auto">
          <div className="icon-circle icon-circle-primary w-16 h-16 mx-auto mb-5 text-2xl">
            <Sprout size={28} />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>
            Bem-vindo ao DeckFarm
          </h2>
          <p className="text-sm mb-7" style={{ color: 'var(--fg-muted)', lineHeight: 1.7 }}>
            Comece cadastrando sua primeira fazenda para gerenciar talhões e aplicações agrícolas.
          </p>
          <Link href="/fazendas">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
              style={{ background: 'hsl(160 84% 22%)', boxShadow: '0 4px 16px hsl(160 84% 22% / 0.3)' }}
            >
              <Plus size={15} />
              Cadastrar Fazenda
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Stats grid ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="animate-enter-2">
              <StatCard label="Atrasadas" value={stats?.atrasadas || 0} icon={AlertTriangle}
                color="hsl(4 72% 50%)" bg="hsl(4 86% 96%)" border="hsl(4 72% 50%)" />
            </div>
            <div className="animate-enter-3">
              <StatCard label="Para hoje" value={stats?.hoje || 0} icon={Clock}
                color="hsl(210 100% 45%)" bg="hsl(210 100% 96%)" border="hsl(210 100% 45%)" />
            </div>
            <div className="animate-enter-4">
              <StatCard label="Esta semana" value={stats?.proximas || 0} icon={Calendar}
                color="hsl(38 70% 40%)" bg="hsl(38 92% 95%)" border="hsl(38 92% 46%)" />
            </div>
            <div className="animate-enter-5">
              <StatCard label="No prazo" value={stats?.dentro_prazo || 0} icon={CheckCircle2}
                color="hsl(160 84% 22%)" bg="var(--verde-50)" border="var(--verde-500)" />
            </div>
          </div>

          {/* ── Overview strip ─── */}
          <div className="animate-enter-3 flex flex-wrap gap-2.5">
            {[
              { icon: MapPin, label: 'Fazendas', value: stats?.total_fazendas },
              { icon: Leaf, label: 'Talhões', value: stats?.total_talhoes },
              { icon: BarChart3, label: 'Aplicações', value: stats?.total_aplicacoes },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', boxShadow: 'var(--shadow-xs)' }}
              >
                <div className="icon-sq w-7 h-7 icon-sq-verde rounded-lg flex items-center justify-center">
                  <Icon size={13} />
                </div>
                <span className="text-[1.0625rem] font-bold" style={{ color: 'var(--fg)' }}>{value}</span>
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Alert banner ─── */}
          {(stats?.atrasadas || 0) > 0 && (
            <div
              className="animate-enter-3 flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: 'hsl(4 80% 97%)', border: '1px solid hsl(4 72% 88%)' }}
            >
              <div className="icon-sq w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(4 86% 93%)', color: 'hsl(4 72% 50%)' }}>
                <AlertTriangle size={15} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'hsl(4 72% 30%)' }}>
                  Atenção agronômica
                </p>
                <p className="text-sm mt-0.5 leading-relaxed" style={{ color: 'hsl(4 72% 42%)' }}>
                  {stats?.atrasadas} aplicação{(stats?.atrasadas ?? 0) !== 1 ? 'ões' : ''} em atraso.
                  Verifique os talhões e regularize o manejo.
                </p>
              </div>
              <Link href="/aplicacoes">
                <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'hsl(4 72% 45%)' }}>
                  Ver →
                </span>
              </Link>
            </div>
          )}

          {/* ── Urgent applications ─── */}
          {urgentes.length > 0 && (
            <div className="animate-enter-4">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="section-label mb-0.5">Prioridade máxima</p>
                  <h2 className="text-base font-bold" style={{ color: 'var(--fg)' }}>Requer atenção</h2>
                </div>
                <Link href="/aplicacoes" className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: 'hsl(160 84% 22%)' }}>
                  Ver todas <ChevronRight size={14} />
                </Link>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {urgentes.map(a => <AplicacaoCard key={a.id} aplicacao={a} />)}
              </div>
            </div>
          )}

          {/* ── Farms ─── */}
          {fazendas.length > 0 && (
            <div className="animate-enter-5">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="section-label mb-0.5">Propriedades</p>
                  <h2 className="text-base font-bold" style={{ color: 'var(--fg)' }}>Suas Fazendas</h2>
                </div>
                <Link href="/fazendas" className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: 'hsl(160 84% 22%)' }}>
                  Gerenciar <ChevronRight size={14} />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fazendas.map(f => {
                  const talhoesF = talhoes.filter(t => t.fazenda_id === f.id)
                  const appsF = aplicacoes.filter(a => talhoesF.some(t => t.id === a.talhao_id))
                  const atrasadas = appsF.filter(a => a.status === 'atrasado').length
                  return (
                    <Link key={f.id} href={`/fazendas/${f.id}`}>
                      <div className="card card-interactive p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="icon-sq w-10 h-10 icon-sq-verde rounded-xl flex items-center justify-center">
                            <MapPin size={17} />
                          </div>
                          {atrasadas > 0 && (
                            <span className="badge-status badge-danger">{atrasadas} atras.</span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm mb-0.5" style={{ color: 'var(--fg)' }}>{f.nome}</h3>
                        <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>{f.localizacao}</p>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--fg-subtle)', borderTop: '1px solid var(--borda)', paddingTop: '0.75rem' }}>
                          <span className="flex items-center gap-1.5"><Leaf size={11} />{talhoesF.length} talhões</span>
                          <span className="flex items-center gap-1.5"><TrendingUp size={11} />{appsF.length} aplic.</span>
                        </div>
                      </div>
                    </Link>
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
