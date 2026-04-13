'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { gerarId, culturaLabel, culturaIcon, produtoTipoLabel, produtoTipoColor, formatDate } from '@/lib/utils'
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

  const [talhaoModal, setTalhaoModal] = useState(false)
  const [editTalhao, setEditTalhao] = useState<Talhao | null>(null)
  const [talhaoForm, setTalhaoForm] = useState({ nome: '', area: '', cultura: 'soja' as CulturaType })
  const [talhaoLoading, setTalhaoLoading] = useState(false)

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

  if (!fazenda) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--fg-subtle)' }}>
      Fazenda não encontrada
    </div>
  )

  return (
    <div className="px-4 py-6 md:px-8 max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="animate-enter animate-enter-1 flex items-center gap-3 mb-8">
        <Link
          href="/fazendas"
          className="p-2 rounded-xl transition flex-shrink-0"
          style={{ border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>
              {fazenda.nome}
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {fazenda.localizacao}{fazenda.area_total ? ` · ${fazenda.area_total} ha` : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="animate-enter animate-enter-2 flex p-1 rounded-xl mb-6"
        style={{ background: 'var(--bg-dark)' }}
      >
        {(['talhoes', 'produtos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            style={{
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow: tab === t ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {t === 'talhoes'
              ? <><Leaf className="w-4 h-4" />Talhões ({talhoes.length})</>
              : <><Package className="w-4 h-4" />Produtos ({produtos.length})</>
            }
          </button>
        ))}
      </div>

      {/* Talhões */}
      {tab === 'talhoes' && (
        <div className="animate-enter animate-enter-3">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Áreas de cultivo</p>
            <Button
              size="sm"
              onClick={() => { setEditTalhao(null); setTalhaoForm({ nome: '', area: '', cultura: 'soja' }); setTalhaoModal(true) }}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />Novo Talhão
            </Button>
          </div>
          {talhoes.length === 0 ? (
            <div className="card p-12 text-center">
              <Leaf className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p style={{ color: 'var(--fg-muted)' }}>Nenhum talhão cadastrado</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {talhoes.map(t => (
                <div key={t.id} className="card">
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'var(--verde-50)' }}
                      >
                        {culturaIcon(t.cultura)}
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>{t.nome}</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                          {culturaLabel(t.cultura)} · {t.area} ha
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => { setEditTalhao(t); setTalhaoForm({ nome: t.nome, area: t.area.toString(), cultura: t.cultura }); setTalhaoModal(true) }}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTalhao(t)}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 86% 95%)'; e.currentTarget.style.color = 'hsl(0 72% 51%)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <Link
                    href={`/talhoes/${t.id}`}
                    className="flex items-center justify-between px-4 py-2.5 rounded-b-[calc(var(--radius-lg)-1px)] text-sm font-medium transition"
                    style={{ borderTop: '1px solid var(--borda)', color: 'var(--primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--verde-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
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
        <div className="animate-enter animate-enter-3">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Produtos da fazenda</p>
            <Button
              size="sm"
              onClick={() => { setEditProduto(null); setProdutoForm({ nome: '', tipo: 'herbicida', prazo_medio_aplicacao: '', fabricante: '' }); setProdutoModal(true) }}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />Novo Produto
            </Button>
          </div>
          {produtos.length === 0 ? (
            <div className="card p-12 text-center">
              <Package className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p style={{ color: 'var(--fg-muted)' }}>Nenhum produto cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {produtos.map(p => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'hsl(270 60% 96%)' }}
                    >
                      <FlaskConical className="w-4 h-4" style={{ color: 'hsl(270 60% 55%)' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm" style={{ color: 'var(--fg)' }}>{p.nome}</h3>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={(() => {
                            const c = produtoTipoColor(p.tipo)
                            return {}
                          })()}
                        >
                          <span className={produtoTipoColor(p.tipo)}>{produtoTipoLabel(p.tipo)}</span>
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        {p.fabricante ? `${p.fabricante} · ` : ''}Reaplicar a cada {p.prazo_medio_aplicacao} dias
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => { setEditProduto(p); setProdutoForm({ nome: p.nome, tipo: p.tipo, prazo_medio_aplicacao: p.prazo_medio_aplicacao.toString(), fabricante: p.fabricante || '' }); setProdutoModal(true) }}
                      className="p-1.5 rounded-lg transition"
                      style={{ color: 'var(--fg-subtle)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduto(p)}
                      className="p-1.5 rounded-lg transition"
                      style={{ color: 'var(--fg-subtle)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 86% 95%)'; e.currentTarget.style.color = 'hsl(0 72% 51%)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
