'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { getDashboardStats } from '@/lib/db/aplicacoes'
import { StatCard } from '@/components/dashboard/stat-card'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { cn, formatDate, culturaLabel, culturaIcon } from '@/lib/utils'
import type { Aplicacao, Fazenda, Talhao } from '@/types'
import {
  AlertTriangle, Clock, CheckCircle2, Calendar, MapPin, Leaf, Plus,
  ChevronRight, RefreshCw, Sprout, TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { stats, setStats, fazendas, setFazendas, talhoes, setTalhoes, aplicacoes, setAplicacoes, notificacoes, setNotificacoes } = useAppStore()
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
      // Enrich with talhao and produto
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
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      </div>
    )
  }

  const hasData = (stats?.total_fazendas || 0) > 0

  return (
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto space-y-6 animate-slide-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user?.nome?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 transition" title="Atualizar">
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {!hasData ? (
        /* Empty state */
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Bem-vindo ao DeckFarm!</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">Comece cadastrando sua primeira fazenda para gerenciar seus talhões e aplicações agrícolas.</p>
          <Link href="/fazendas">
            <Button size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              Cadastrar Fazenda
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Atrasadas" value={stats?.atrasadas || 0} icon={AlertTriangle} variant="danger" description="Requerem atenção" />
            <StatCard label="Hoje" value={stats?.hoje || 0} icon={Clock} variant="info" description="Fazer agora" />
            <StatCard label="Esta semana" value={stats?.proximas || 0} icon={Calendar} variant="warning" description="Em até 7 dias" />
            <StatCard label="No prazo" value={stats?.dentro_prazo || 0} icon={CheckCircle2} variant="success" description="Sob controle" />
          </div>

          {/* Farm overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <MapPin className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-gray-900">{stats?.total_fazendas}</div>
              <div className="text-xs text-gray-500">Fazendas</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <Leaf className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-gray-900">{stats?.total_talhoes}</div>
              <div className="text-xs text-gray-500">Talhões</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-gray-900">{stats?.total_aplicacoes}</div>
              <div className="text-xs text-gray-500">Aplicações</div>
            </div>
          </div>

          {/* Alertas assistente */}
          {(stats?.atrasadas || 0) > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Atenção do Assistente Agronômico</p>
                <p className="text-sm text-red-700 mt-0.5">
                  Você tem <strong>{stats?.atrasadas}</strong> aplicação{stats?.atrasadas !== 1 ? 'ões' : ''} atrasada{stats?.atrasadas !== 1 ? 's' : ''}. Verifique os talhões e regularize o manejo.
                </p>
              </div>
            </div>
          )}

          {/* Urgentes */}
          {urgentes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Requer Atenção</h2>
                <Link href="/aplicacoes" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
                  Ver todas <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {urgentes.map(a => <AplicacaoCard key={a.id} aplicacao={a} />)}
              </div>
            </div>
          )}

          {/* Fazendas quick */}
          {fazendas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Fazendas</h2>
                <Link href="/fazendas" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
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
                      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{f.nome}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{f.localizacao}</p>
                          </div>
                          {atrasadas > 0 && (
                            <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">{atrasadas} atras.</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
                          <span className="flex items-center gap-1"><Leaf className="w-3 h-3" />{talhoesF.length} talhões</span>
                          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{appsF.length} aplicações</span>
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
