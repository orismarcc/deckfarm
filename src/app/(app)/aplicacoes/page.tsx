'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { Select } from '@/components/ui/select'
import type { Aplicacao } from '@/types'
import { FlaskConical, Filter } from 'lucide-react'

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
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aplicações</h1>
        <p className="text-gray-500 text-sm">
          {aplicacoes.length} aplicação{aplicacoes.length !== 1 ? 'ões' : ''} registrada{aplicacoes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
          {hasFilters && (
            <button
              onClick={() => { setFiltroStatus(''); setFiltroFazenda(''); setFiltroCultura('') }}
              className="ml-auto text-xs text-green-600 hover:text-green-700"
            >
              Limpar filtros
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
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhuma aplicação encontrada</p>
          <p className="text-sm mt-1">
            {hasFilters ? 'Tente ajustar os filtros.' : 'Vá a um talhão e registre a primeira aplicação.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => <AplicacaoCard key={a.id} aplicacao={a} />)}
        </div>
      )}
    </div>
  )
}
