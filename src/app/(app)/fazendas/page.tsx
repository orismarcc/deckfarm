'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gerarId } from '@/lib/utils'
import type { Fazenda } from '@/types'
import { Plus, MapPin, Leaf, TrendingUp, Trash2, Edit3, ChevronRight, Search } from 'lucide-react'
import Link from 'next/link'

export default function FazendasPage() {
  const { user } = useAuthStore()
  const { fazendas, setFazendas, talhoes, setTalhoes, aplicacoes, addFazenda, updateFazenda, deleteFazenda } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Fazenda | null>(null)
  const [form, setForm] = useState({ nome: '', localizacao: '', area_total: '' })
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    const db = getDB()
    const [fazs, tals] = await Promise.all([
      db.fazendas.where('usuario_id').equals(user.id).toArray(),
      db.talhoes.toArray(),
    ])
    setFazendas(fazs)
    setTalhoes(tals)
  }, [user, setFazendas, setTalhoes])

  useEffect(() => { loadData() }, [loadData])

  function openModal(f?: Fazenda) {
    if (f) {
      setEditando(f)
      setForm({ nome: f.nome, localizacao: f.localizacao, area_total: f.area_total?.toString() || '' })
    } else {
      setEditando(null)
      setForm({ nome: '', localizacao: '', area_total: '' })
    }
    setModalOpen(true)
  }

  async function handleSave() {
    if (!user || !form.nome || !form.localizacao) return
    setLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      if (editando) {
        const updated = { ...editando, ...form, area_total: form.area_total ? Number(form.area_total) : undefined, updatedAt: now, _syncStatus: 'pending' as const }
        await db.fazendas.put(updated)
        updateFazenda(editando.id, updated)
      } else {
        const fazenda: Fazenda = {
          id: gerarId(), nome: form.nome, localizacao: form.localizacao,
          area_total: form.area_total ? Number(form.area_total) : undefined,
          usuario_id: user.id, createdAt: now, updatedAt: now, _syncStatus: 'pending',
        }
        await db.fazendas.add(fazenda)
        addFazenda(fazenda)
      }
      setModalOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(f: Fazenda) {
    if (!confirm(`Excluir fazenda "${f.nome}"? Todos os talhões e dados serão perdidos.`)) return
    const db = getDB()
    await db.fazendas.delete(f.id)
    deleteFazenda(f.id)
  }

  const filtered = fazendas.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.localizacao.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-center justify-between mb-8">
        <div>
          <p className="section-label mb-1">Propriedades</p>
          <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--fg)' }}>
            Fazendas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {fazendas.length} fazenda{fazendas.length !== 1 ? 's' : ''} cadastrada{fazendas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Fazenda
        </Button>
      </div>

      {/* Search */}
      {fazendas.length > 2 && (
        <div className="animate-enter animate-enter-2 relative mb-6">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--fg-subtle)' }}
          />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou localização..."
            style={{
              width: '100%',
              maxWidth: '360px',
              paddingLeft: '2.5rem',
              paddingRight: '1rem',
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--borda)',
              background: 'var(--bg-card)',
              color: 'var(--fg)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div
          className="animate-enter animate-enter-2 card p-16 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--bg-dark)' }}
          >
            <MapPin className="w-8 h-8" style={{ color: 'var(--fg-subtle)' }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhuma fazenda encontrada</p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {busca ? 'Tente outro termo.' : 'Clique em "Nova Fazenda" para começar.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f, i) => {
            const talhoesF = talhoes.filter(t => t.fazenda_id === f.id)
            const appsF = aplicacoes.filter(a => talhoesF.some(t => t.id === a.talhao_id))
            const atrasadas = appsF.filter(a => a.status === 'atrasado').length
            return (
              <div
                key={f.id}
                className="card animate-enter"
                style={{ animationDelay: `${(i + 2) * 70}ms` }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--verde-50)' }}
                      >
                        <MapPin className="w-5 h-5" style={{ color: 'var(--verde-500)' }} />
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>{f.nome}</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{f.localizacao}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => openModal(f)}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(f)}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 86% 95%)'; e.currentTarget.style.color = 'hsl(0 72% 51%)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div
                      className="rounded-xl px-3 py-2.5"
                      style={{ background: 'var(--bg)' }}
                    >
                      <div className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{talhoesF.length}</div>
                      <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        <Leaf className="w-3 h-3" />Talhões
                      </div>
                    </div>
                    <div
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background: atrasadas > 0 ? 'hsl(0 86% 97%)' : 'var(--bg)',
                      }}
                    >
                      <div
                        className="text-xl font-bold"
                        style={{ color: atrasadas > 0 ? 'hsl(0 72% 45%)' : 'var(--fg)' }}
                      >
                        {atrasadas}
                      </div>
                      <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        <TrendingUp className="w-3 h-3" />Atrasadas
                      </div>
                    </div>
                  </div>

                  {f.area_total && (
                    <p className="text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>
                      {f.area_total.toLocaleString('pt-BR')} hectares
                    </p>
                  )}
                </div>

                <Link
                  href={`/fazendas/${f.id}`}
                  className="flex items-center justify-between px-5 py-3 rounded-b-[calc(var(--radius-lg)-1px)] text-sm font-medium transition"
                  style={{
                    borderTop: '1px solid var(--borda)',
                    color: 'var(--primary)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--verde-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Ver talhões e produtos <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Fazenda' : 'Nova Fazenda'}>
        <div className="space-y-4">
          <Input label="Nome da fazenda" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Fazenda Santa Rita" required />
          <Input label="Localização / Município" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Confresa - MT" />
          <Input label="Área total (hectares)" type="number" value={form.area_total} onChange={e => setForm(f => ({ ...f, area_total: e.target.value }))} placeholder="Ex: 500" />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} loading={loading} className="flex-1">{editando ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
