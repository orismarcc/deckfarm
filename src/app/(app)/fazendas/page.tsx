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
  const [form, setForm] = useState({ nome: '', localizacao: '', nome_produtor: '', area_total: '' })
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  const loadData = useCallback(async () => {
    if (!user) return
    const db = getDB()
    const [fazs, tals] = await Promise.all([
      db.fazendas.where('usuario_id').equals(user.id).toArray(),
      db.talhoes.toArray(),
    ])
    setFazendas(fazs); setTalhoes(tals)
  }, [user, setFazendas, setTalhoes])

  useEffect(() => { loadData() }, [loadData])

  function openModal(f?: Fazenda) {
    if (f) {
      setEditando(f)
      setForm({ nome: f.nome, localizacao: f.localizacao, nome_produtor: f.nome_produtor || '', area_total: f.area_total?.toString() || '' })
    } else {
      setEditando(null)
      setForm({ nome: '', localizacao: '', nome_produtor: '', area_total: '' })
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
        const updated = { ...editando, nome: form.nome, localizacao: form.localizacao, nome_produtor: form.nome_produtor || undefined, area_total: form.area_total ? Number(form.area_total) : undefined, updatedAt: now, _syncStatus: 'pending' as const }
        await db.fazendas.put(updated)
        updateFazenda(editando.id, updated)
      } else {
        const fazenda: Fazenda = {
          id: gerarId(), nome: form.nome, localizacao: form.localizacao,
          nome_produtor: form.nome_produtor || undefined,
          area_total: form.area_total ? Number(form.area_total) : undefined,
          usuario_id: user.id, createdAt: now, updatedAt: now, _syncStatus: 'pending',
        }
        await db.fazendas.add(fazenda)
        addFazenda(fazenda)
      }
      setModalOpen(false)
    } finally { setLoading(false) }
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
      <div className="animate-enter-1 flex items-start justify-between mb-8">
        <div>
          <p className="section-label mb-1">Propriedades</p>
          <h1 className="font-display text-[2rem] font-bold" style={{ color: 'var(--fg)' }}>Fazendas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {fazendas.length} fazenda{fazendas.length !== 1 ? 's' : ''} cadastrada{fazendas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 mt-1">
          <Plus size={14} /> Nova Fazenda
        </Button>
      </div>

      {/* Search */}
      {fazendas.length > 2 && (
        <div className="animate-enter-2 relative mb-6 max-w-xs">
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar fazenda..."
            className="field-input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card animate-enter-2 p-14 text-center max-w-sm mx-auto">
          <div className="icon-circle icon-circle-muted w-14 h-14 mx-auto mb-4"><MapPin size={22} /></div>
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
              <div key={f.id} className="card animate-enter flex flex-col" style={{ animationDelay: `${(i + 2) * 60}ms` }}>
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="icon-sq w-11 h-11 icon-sq-verde rounded-xl flex items-center justify-center">
                      <MapPin size={18} />
                    </div>
                    <div className="flex items-center gap-1">
                      {atrasadas > 0 && (
                        <span className="badge-status badge-danger">{atrasadas} atras.</span>
                      )}
                      <button onClick={() => openModal(f)} className="p-1.5 rounded-lg transition ml-1"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => handleDelete(f)} className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'hsl(4 86% 96%)'; e.currentTarget.style.color = 'hsl(4 72% 50%)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold mb-0.5" style={{ color: 'var(--fg)' }}>{f.nome}</h3>
                  <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{f.localizacao}</p>
                  {f.nome_produtor && (
                    <p className="text-xs mb-4 mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                      Produtor: {f.nome_produtor}
                    </p>
                  )}
                  {!f.nome_produtor && <div className="mb-4" />}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg)' }}>
                      <div className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{talhoesF.length}</div>
                      <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        <Leaf size={10} />Talhões
                      </div>
                    </div>
                    <div className="rounded-xl px-3 py-2.5"
                      style={{ background: atrasadas > 0 ? 'hsl(4 80% 97%)' : 'var(--bg)' }}>
                      <div className="text-lg font-bold" style={{ color: atrasadas > 0 ? 'hsl(4 72% 45%)' : 'var(--fg)' }}>
                        {atrasadas}
                      </div>
                      <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        <TrendingUp size={10} />Atrasadas
                      </div>
                    </div>
                  </div>

                  {f.area_total && (
                    <p className="text-xs mt-3" style={{ color: 'var(--fg-subtle)' }}>
                      {f.area_total.toLocaleString('pt-BR')} hectares
                    </p>
                  )}
                </div>

                <Link href={`/fazendas/${f.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm font-semibold transition"
                  style={{ borderTop: '1px solid var(--borda)', color: 'hsl(160 84% 22%)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--verde-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Ver talhões e produtos <ChevronRight size={14} />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Fazenda' : 'Nova Fazenda'}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} loading={loading} className="flex-1">{editando ? 'Salvar' : 'Criar'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Nome da fazenda" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Fazenda Santa Rita" required />
          <Input label="Nome do produtor" value={form.nome_produtor} onChange={e => setForm(f => ({ ...f, nome_produtor: e.target.value }))} placeholder="Ex: João da Silva" />
          <Input label="Localização / Município" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Confresa - MT" />
          <Input label="Área total (hectares)" type="number" value={form.area_total} onChange={e => setForm(f => ({ ...f, area_total: e.target.value }))} placeholder="Ex: 500" />
        </div>
      </Modal>
    </div>
  )
}
