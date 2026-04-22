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
  const { fazendas, setFazendas, lastServerSyncAt } = useAppStore()
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
        const apps = await db.aplicacoes.where('talhao_id').equals(t.id).filter(a => !a.deleted_at).toArray()
        const atrasadas = apps.filter(a => a.status === 'atrasado').length
        return { ...t, fazenda, atrasadas }
      }))
      setTalhoes(enriched)
    } finally { setLoading(false) }
  }, [user, setFazendas])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      <div className="animate-enter-1 mb-8">
        <p className="section-label mb-1">Mapa de cultivo</p>
        <h1 className="font-display text-[2rem] font-bold" style={{ color: 'var(--fg)' }}>Talhões</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          {talhoes.length} talhão{talhoes.length !== 1 ? 'ões' : ''} cadastrado{talhoes.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="animate-enter-2 flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar talhão..."
            className="field-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <div className="w-44 flex-shrink-0">
          <Select value={filtroFazenda} onChange={e => setFiltroFazenda(e.target.value)} options={fazendaOptions} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card animate-enter-2 p-14 text-center">
          <div className="icon-circle icon-circle-muted w-14 h-14 mx-auto mb-4"><Leaf size={22} /></div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhum talhão encontrado</p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {busca || filtroFazenda ? 'Tente ajustar os filtros.' : 'Cadastre talhões dentro de cada fazenda.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((t, i) => (
            <Link key={t.id} href={`/talhoes/${t.id}`}>
              <div className="card card-interactive p-4 animate-enter" style={{ animationDelay: `${(i + 2) * 60}ms` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="icon-sq w-11 h-11 icon-sq-verde rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                      {culturaIcon(t.cultura)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{t.nome}</h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{t.fazenda?.nome}</p>
                    </div>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                </div>
                <div className="flex items-center justify-between mt-3.5 pt-3"
                  style={{ borderTop: '1px solid var(--borda)' }}>
                  <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {culturaLabel(t.cultura)} · {t.area} ha
                  </span>
                  {t.atrasadas > 0 && (
                    <span className="badge-status badge-danger">
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
