'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn, gerarId, culturaLabel, culturaIcon, produtoTipoLabel, produtoTipoColor, formatDate } from '@/lib/utils'
import type { Fazenda, Talhao, Produto, CulturaType, ProdutoTipo } from '@/types'
import { Plus, Leaf, FlaskConical, Trash2, Edit3, ArrowLeft, Package, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const culturas: { value: CulturaType; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'milho_safrinha', label: 'Milho Safrinha' },
  { value: 'gergelim', label: 'Gergelim' },
  { value: 'feijao', label: 'Feijão' },
  { value: 'algodao', label: 'Algodão' },
]

const tiposProduto: { value: ProdutoTipo; label: string }[] = [
  { value: 'herbicida', label: 'Herbicida' },
  { value: 'fertilizante', label: 'Fertilizante' },
  { value: 'defensivo', label: 'Defensivo' },
  { value: 'fungicida', label: 'Fungicida' },
  { value: 'inseticida', label: 'Inseticida' },
]

export default function FazendaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [fazenda, setFazenda] = useState<Fazenda | null>(null)
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [tab, setTab] = useState<'talhoes' | 'produtos'>('talhoes')

  // Talhao modal
  const [talhaoModal, setTalhaoModal] = useState(false)
  const [editTalhao, setEditTalhao] = useState<Talhao | null>(null)
  const [talhaoForm, setTalhaoForm] = useState({ nome: '', area: '', cultura: 'soja' as CulturaType })
  const [talhaoLoading, setTalhaoLoading] = useState(false)

  // Produto modal
  const [produtoModal, setProdutoModal] = useState(false)
  const [editProduto, setEditProduto] = useState<Produto | null>(null)
  const [produtoForm, setProdutoForm] = useState({ nome: '', tipo: 'herbicida' as ProdutoTipo, prazo_medio_aplicacao: '', fabricante: '' })
  const [produtoLoading, setProdutoLoading] = useState(false)

  const loadData = useCallback(async () => {
    const db = getDB()
    const [faz, tals, prods] = await Promise.all([
      db.fazendas.get(id),
      db.talhoes.where('fazenda_id').equals(id).toArray(),
      db.produtos.where('fazenda_id').equals(id).toArray(),
    ])
    setFazenda(faz || null)
    setTalhoes(tals)
    setProdutos(prods)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function saveTalhao() {
    if (!talhaoForm.nome || !talhaoForm.area) return
    setTalhaoLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      if (editTalhao) {
        const t = { ...editTalhao, nome: talhaoForm.nome, area: Number(talhaoForm.area), cultura: talhaoForm.cultura, updatedAt: now }
        await db.talhoes.put(t)
      } else {
        const t: Talhao = { id: gerarId(), nome: talhaoForm.nome, area: Number(talhaoForm.area), cultura: talhaoForm.cultura, fazenda_id: id, createdAt: now, updatedAt: now, _syncStatus: 'pending' }
        await db.talhoes.add(t)
      }
      await loadData()
      setTalhaoModal(false)
    } finally { setTalhaoLoading(false) }
  }

  async function deleteTalhao(t: Talhao) {
    if (!confirm(`Excluir talhão "${t.nome}"?`)) return
    await getDB().talhoes.delete(t.id)
    await loadData()
  }

  async function saveProduto() {
    if (!produtoForm.nome || !produtoForm.prazo_medio_aplicacao) return
    setProdutoLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      if (editProduto) {
        const p = { ...editProduto, ...produtoForm, prazo_medio_aplicacao: Number(produtoForm.prazo_medio_aplicacao), updatedAt: now }
        await db.produtos.put(p)
      } else {
        const p: Produto = { id: gerarId(), nome: produtoForm.nome, tipo: produtoForm.tipo, prazo_medio_aplicacao: Number(produtoForm.prazo_medio_aplicacao), fabricante: produtoForm.fabricante, fazenda_id: id, createdAt: now, updatedAt: now, _syncStatus: 'pending' }
        await db.produtos.add(p)
      }
      await loadData()
      setProdutoModal(false)
    } finally { setProdutoLoading(false) }
  }

  async function deleteProduto(p: Produto) {
    if (!confirm(`Excluir produto "${p.nome}"?`)) return
    await getDB().produtos.delete(p.id)
    await loadData()
  }

  if (!fazenda) return <div className="p-8 text-center text-gray-400">Fazenda não encontrada</div>

  return (
    <div className="px-4 py-6 md:px-8 max-w-5xl mx-auto animate-slide-in">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/fazendas" className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{fazenda.nome}</h1>
          <p className="text-sm text-gray-500">{fazenda.localizacao}{fazenda.area_total ? ` · ${fazenda.area_total} ha` : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {(['talhoes', 'produtos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2',
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'talhoes' ? <><Leaf className="w-4 h-4" />Talhões ({talhoes.length})</> : <><Package className="w-4 h-4" />Produtos ({produtos.length})</>}
          </button>
        ))}
      </div>

      {/* Talhões */}
      {tab === 'talhoes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Talhões</h2>
            <Button size="sm" onClick={() => { setEditTalhao(null); setTalhaoForm({ nome: '', area: '', cultura: 'soja' }); setTalhaoModal(true) }} className="gap-1">
              <Plus className="w-4 h-4" />Novo Talhão
            </Button>
          </div>
          {talhoes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Leaf className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum talhão cadastrado</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {talhoes.map(t => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">{culturaIcon(t.cultura)}</div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{t.nome}</h3>
                        <p className="text-xs text-gray-500">{culturaLabel(t.cultura)} · {t.area} ha</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditTalhao(t); setTalhaoForm({ nome: t.nome, area: t.area.toString(), cultura: t.cultura }); setTalhaoModal(true) }} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><Edit3 className="w-4 h-4 text-gray-400" /></button>
                      <button onClick={() => deleteTalhao(t)} className="p-1.5 rounded-lg hover:bg-red-50 transition"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                  <Link href={`/talhoes/${t.id}`} className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-sm text-green-600 font-medium hover:bg-green-50 rounded-b-xl">
                    Ver histórico <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Produtos */}
      {tab === 'produtos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Produtos da Fazenda</h2>
            <Button size="sm" onClick={() => { setEditProduto(null); setProdutoForm({ nome: '', tipo: 'herbicida', prazo_medio_aplicacao: '', fabricante: '' }); setProdutoModal(true) }} className="gap-1">
              <Plus className="w-4 h-4" />Novo Produto
            </Button>
          </div>
          {produtos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum produto cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {produtos.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                      <FlaskConical className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{p.nome}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', produtoTipoColor(p.tipo))}>{produtoTipoLabel(p.tipo)}</span>
                      </div>
                      <p className="text-xs text-gray-500">{p.fabricante ? `${p.fabricante} · ` : ''}Prazo: {p.prazo_medio_aplicacao} dias</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditProduto(p); setProdutoForm({ nome: p.nome, tipo: p.tipo, prazo_medio_aplicacao: p.prazo_medio_aplicacao.toString(), fabricante: p.fabricante || '' }); setProdutoModal(true) }} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><Edit3 className="w-4 h-4 text-gray-400" /></button>
                    <button onClick={() => deleteProduto(p)} className="p-1.5 rounded-lg hover:bg-red-50 transition"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Talhao Modal */}
      <Modal open={talhaoModal} onClose={() => setTalhaoModal(false)} title={editTalhao ? 'Editar Talhão' : 'Novo Talhão'}>
        <div className="space-y-4">
          <Input label="Nome do talhão" value={talhaoForm.nome} onChange={e => setTalhaoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Talhão 01" />
          <Input label="Área (hectares)" type="number" value={talhaoForm.area} onChange={e => setTalhaoForm(f => ({ ...f, area: e.target.value }))} placeholder="Ex: 50" />
          <Select label="Cultura" value={talhaoForm.cultura} onChange={e => setTalhaoForm(f => ({ ...f, cultura: e.target.value as CulturaType }))} options={culturas} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setTalhaoModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={saveTalhao} loading={talhaoLoading} className="flex-1">{editTalhao ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Produto Modal */}
      <Modal open={produtoModal} onClose={() => setProdutoModal(false)} title={editProduto ? 'Editar Produto' : 'Novo Produto'}>
        <div className="space-y-4">
          <Input label="Nome do produto" value={produtoForm.nome} onChange={e => setProdutoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Glifosato 360" />
          <Select label="Tipo" value={produtoForm.tipo} onChange={e => setProdutoForm(f => ({ ...f, tipo: e.target.value as ProdutoTipo }))} options={tiposProduto} />
          <Input label="Prazo médio de reaplicação (dias)" type="number" value={produtoForm.prazo_medio_aplicacao} onChange={e => setProdutoForm(f => ({ ...f, prazo_medio_aplicacao: e.target.value }))} placeholder="Ex: 21" />
          <Input label="Fabricante (opcional)" value={produtoForm.fabricante} onChange={e => setProdutoForm(f => ({ ...f, fabricante: e.target.value }))} placeholder="Ex: Bayer" />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setProdutoModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={saveProduto} loading={produtoLoading} className="flex-1">{editProduto ? 'Salvar' : 'Criar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
