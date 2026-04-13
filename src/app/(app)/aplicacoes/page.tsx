'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { Select } from '@/components/ui/select'
import type { Aplicacao } from '@/types'
import { FlaskConical, Filter, X } from 'lucide-react'

const statusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'atrasado', label: 'Atrasadas' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'proximo', label: 'Próximas (7d)' },
  { value: 'dentro_do_prazo', label: 'No prazo' },
]

const culturaOptions = [
  { value: '', label: 'Todas as culturas' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'milho_safrinha', label: 'Milho Safrinha' },
  { value: 'gergelim', label: 'Gergelim' },
  { value: 'feijao', label: 'Feijão' },
  { value: 'algodao', label: 'Algodão' },
]

export default function AplicacoesPage() {
  const { user } = useAuthStore()
  const { fazendas, setFazendas } = useAppStore()
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFazenda, setFiltroFazenda] = useState('')
  const [filtroCultura, setFiltroCultura] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const fazs = await db.fazendas.where('usuario_id').equals(user.id).toArray()
      setFazendas(fazs)
      const apps = await db.aplicacoes.where('usuario_id').equals(user.id).reverse().sortBy('data_aplicacao')
      const enriched = await Promise.all(apps.map(async a => {
        const [talhao, produto] = await Promise.all([
          db.talhoes.get(a.talhao_id),
          db.produtos.get(a.produto_id),
        ])
        return { ...a, talhao, produto }
      }))
      setAplicacoes(enriched as Aplicacao[])
    } finally { setLoading(false) }
  }, [user, setFazendas])

  useEffect(() => { loadData() }, [loadData])

  const fazendaOptions = [
    { value: '', label: 'Todas as fazendas' },
    ...fazendas.map(f => ({ value: f.id, label: f.nome })),
  ]

  const filtered = aplicacoes.filter(a => {
    if (filtroStatus && a.status !== filtroStatus) return false
    if (filtroFazenda && (a.talhao as any)?.fazenda_id !== filtroFazenda) return false
    if (filtroCultura && (a.talhao as any)?.cultura !== filtroCultura) return false
    return true
  })

  const hasFilters = filtroStatus || filtroFazenda || filtroCultura

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 mb-8">
        <p className="section-label mb-1">Manejo</p>
        <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--fg)' }}>
          Aplicações
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          {aplicacoes.length} aplicação{aplicacoes.length !== 1 ? 'ões' : ''} registrada{aplicacoes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="animate-enter animate-enter-2 card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" style={{ color: 'var(--fg-muted)' }} />
          <span className="section-label" style={{ margin: 0 }}>Filtros</span>
          {hasFilters && (
            <button
              onClick={() => { setFiltroStatus(''); setFiltroFazenda(''); setFiltroCultura('') }}
              className="ml-auto flex items-center gap-1 text-xs font-medium transition"
              style={{ color: 'var(--primary)' }}
            >
              <X className="w-3 h-3" />Limpar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} options={statusOptions} />
          <Select value={filtroFazenda} onChange={e => setFiltroFazenda(e.target.value)} options={fazendaOptions} />
          <Select value={filtroCultura} onChange={e => setFiltroCultura(e.target.value)} options={culturaOptions} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card animate-enter animate-enter-3 p-14 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--bg-dark)' }}
          >
            <FlaskConical className="w-7 h-7" style={{ color: 'var(--fg-subtle)' }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhuma aplicação encontrada</p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {hasFilters ? 'Tente ajustar os filtros.' : 'Vá a um talhão e registre a primeira aplicação.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <div
              key={a.id}
              className="animate-enter"
              style={{ animationDelay: `${(i + 3) * 50}ms` }}
            >
              <AplicacaoCard aplicacao={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
