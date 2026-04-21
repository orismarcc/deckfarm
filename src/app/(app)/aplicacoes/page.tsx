'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { Select } from '@/components/ui/select'
import type { Aplicacao } from '@/types'
import { FlaskConical, Filter, X } from 'lucide-react'
import { parseISO } from 'date-fns'

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
  const { fazendas, setFazendas, lastServerSyncAt } = useAppStore()
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
        const [talhao, produto] = await Promise.all([db.talhoes.get(a.talhao_id), db.produtos.get(a.produto_id)])
        return { ...a, talhao, produto }
      }))
      setAplicacoes(enriched as Aplicacao[])
    } finally { setLoading(false) }
  }, [user, setFazendas])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    const db = getDB()
    await db.aplicacoes.delete(id)
    setAplicacoes(prev => prev.filter(a => a.id !== id))
  }

  const fazendaOptions = [
    { value: '', label: 'Todas as fazendas' },
    ...fazendas.map(f => ({ value: f.id, label: f.nome })),
  ]

  const filtered = aplicacoes.filter(a => {
    if (filtroStatus && a.status !== filtroStatus) return false
    if (filtroFazenda && (a.talhao as any)?.fazenda_id !== filtroFazenda) return false
    if (filtroCultura && (a.talhao as any)?.cultura !== filtroCultura) return false
    // When no status filter is active, hide far-future planned apps (>14 days away).
    // They'd clutter the list without being actionable. The user can still find them
    // by selecting "No prazo" in the status filter.
    if (!filtroStatus && a.tipo === 'planejada' && a.status === 'dentro_do_prazo') {
      try {
        const d = parseISO(a.data_aplicacao)
        const hoje = new Date(); hoje.setHours(0,0,0,0)
        const diffDias = Math.round((d.getTime() - hoje.getTime()) / 86400000)
        if (diffDias > 14) return false
      } catch { /* keep if date is invalid */ }
    }
    return true
  })

  const hasFilters = filtroStatus || filtroFazenda || filtroCultura

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      <div className="animate-enter-1 mb-8">
        <p className="section-label mb-1">Manejo</p>
        <h1 className="font-display text-[2rem] font-bold" style={{ color: 'var(--fg)' }}>Aplicações</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          {aplicacoes.length} aplicação{aplicacoes.length !== 1 ? 'ões' : ''} registrada{aplicacoes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="animate-enter-2 card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} style={{ color: 'var(--fg-muted)' }} />
          <span className="section-label" style={{ display: 'inline' }}>Filtros</span>
          {hasFilters && (
            <button onClick={() => { setFiltroStatus(''); setFiltroFazenda(''); setFiltroCultura('') }}
              className="ml-auto flex items-center gap-1 text-xs font-semibold"
              style={{ color: 'hsl(160 84% 22%)' }}>
              <X size={11} />Limpar
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
        <div className="card animate-enter-3 p-14 text-center">
          <div className="icon-circle icon-circle-muted w-14 h-14 mx-auto mb-4"><FlaskConical size={22} /></div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhuma aplicação encontrada</p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {hasFilters ? 'Tente ajustar os filtros.' : 'Vá a um talhão e registre a primeira aplicação.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <div key={a.id} className="animate-enter" style={{ animationDelay: `${(i + 3) * 45}ms` }}>
              <AplicacaoCard aplicacao={a} onDelete={() => handleDelete(a.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
