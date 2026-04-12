'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, gerarId } from '@/lib/utils'
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
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fazendas</h1>
          <p className="text-gray-500 text-sm">{fazendas.length} fazenda{fazendas.length !== 1 ? 's' : ''} cadastrada{fazendas.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Fazenda
        </Button>
      </div>

      {/* Search */}
      {fazendas.length > 3 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar fazenda..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhuma fazenda encontrada</p>
          <p className="text-sm mt-1">Clique em "Nova Fazenda" para começar</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => {
            const talhoesF = talhoes.filter(t => t.fazenda_id === f.id)
            const appsF = aplicacoes.filter(a => talhoesF.some(t => t.id === a.talhao_id))
            const atrasadas = appsF.filter(a => a.status === 'atrasado').length
            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{f.nome}</h3>
                        <p className="text-xs text-gray-500">{f.localizacao}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openModal(f)} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><Edit3 className="w-4 h-4 text-gray-400" /></button>
                      <button onClick={() => handleDelete(f)} className="p-1.5 rounded-lg hover:bg-red-50 transition"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-lg font-bold text-gray-900">{talhoesF.length}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><Leaf className="w-3 h-3" />Talhões</div>
                    </div>
                    <div className={cn('rounded-lg px-3 py-2', atrasadas > 0 ? 'bg-red-50' : 'bg-gray-50')}>
                      <div className={cn('text-lg font-bold', atrasadas > 0 ? 'text-red-600' : 'text-gray-900')}>{atrasadas}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Atrasadas</div>
                    </div>
                  </div>

                  {f.area_total && <p className="text-xs text-gray-400 mb-3">{f.area_total} hectares</p>}
                </div>

                <Link href={`/fazendas/${f.id}`} className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-green-600 font-medium hover:bg-green-50 transition rounded-b-xl">
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
