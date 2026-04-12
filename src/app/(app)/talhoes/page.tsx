'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import type { Talhao, Fazenda } from '@/types'
import { culturaLabel, culturaIcon } from '@/lib/utils'
import { Leaf, ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'
import { Select } from '@/components/ui/select'

export default function TalhoesPage() {
  const { user } = useAuthStore()
  const { fazendas, setFazendas } = useAppStore()
  const [talhoes, setTalhoes] = useState<(Talhao & { fazenda?: Fazenda; atrasadas: number })[]>([])
  const [filtroFazenda, setFiltroFazenda] = useState('')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const fazs = await db.fazendas.where('usuario_id').equals(user.id).toArray()
      setFazendas(fazs)
      const fazIds = fazs.map(f => f.id)
      const tals = await db.talhoes.where('fazenda_id').anyOf(fazIds.length ? fazIds : ['']).toArray()
      const enriched = await Promise.all(tals.map(async t => {
        const fazenda = fazs.find(f => f.id === t.fazenda_id)
        const apps = await db.aplicacoes.where('talhao_id').equals(t.id).toArray()
        const atrasadas = apps.filter(a => a.status === 'atrasado').length
        return { ...t, fazenda, atrasadas }
      }))
      setTalhoes(enriched)
    } finally { setLoading(false) }
  }, [user, setFazendas])

  useEffect(() => { loadData() }, [loadData])

  const fazendaOptions = [
    { value: '', label: 'Todas as fazendas' },
    ...fazendas.map(f => ({ value: f.id, label: f.nome })),
  ]

  const filtered = talhoes.filter(t => {
    if (filtroFazenda && t.fazenda_id !== filtroFazenda) return false
    if (busca && !t.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto animate-slide-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Talhões</h1>
        <p className="text-gray-500 text-sm">
          {talhoes.length} talhão{talhoes.length !== 1 ? 'ões' : ''} cadastrado{talhoes.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar talhão..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="w-48">
          <Select value={filtroFazenda} onChange={e => setFiltroFazenda(e.target.value)} options={fazendaOptions} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Leaf className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum talhão encontrado</p>
          <p className="text-sm mt-1">Cadastre talhões dentro de cada fazenda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(t => (
            <Link key={t.id} href={`/talhoes/${t.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow p-4 cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{culturaIcon(t.cultura)}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{t.nome}</h3>
                      <p className="text-xs text-gray-500">{t.fazenda?.nome}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                  <span>{culturaLabel(t.cultura)} · {t.area} ha</span>
                  {t.atrasadas > 0 && (
                    <span className="bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                      {t.atrasadas} atrasada{t.atrasadas !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
