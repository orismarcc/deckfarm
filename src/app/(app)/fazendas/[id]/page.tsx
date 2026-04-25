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
import { PhotoPicker } from '@/components/ui/photo-picker'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { MembrosSection } from '@/components/fazenda/membros-section'
import { gerarId, culturaLabel, culturaIcon, produtoTipoLabel, produtoTipoColor, formatDate } from '@/lib/utils'
import { enqueueSync, processSyncQueue } from '@/lib/db/sync'
import type { Fazenda, Talhao, Produto, Aplicacao, CulturaType, ProdutoTipo, EstoqueMovimentacao } from '@/types'
import { Plus, Leaf, FlaskConical, Trash2, Edit3, ArrowLeft, Package, ChevronRight, FileText, Users, MapPin as MapPinIcon, Cloud, History, TrendingUp, ArrowUp, ArrowDown, ArrowLeftRight, Map, DollarSign, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Leaflet must be client-only (no SSR)
const TalhaoMap = dynamic(
  () => import('@/components/map/talhao-map').then(m => m.TalhaoMap),
  { ssr: false, loading: () => <div className="h-[240px] rounded-xl animate-pulse" style={{ background: 'var(--bg-dark)' }} /> }
)

const TalhoesMap = dynamic(
  () => import('@/components/map/talhoes-map'),
  { ssr: false, loading: () => <div className="rounded-2xl animate-pulse" style={{ height: '520px', background: 'var(--bg-dark)' }} /> }
)

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

type Tab = 'talhoes' | 'produtos' | 'mapa' | 'financeiro' | 'equipe' | 'clima'

export default function FazendaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [fazenda, setFazenda] = useState<Fazenda | null>(null)
  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])
  const [tab, setTab] = useState<Tab>('talhoes')
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([])
  const [reporModal, setReporModal] = useState(false)
  const [reporProduto, setReporProduto] = useState<Produto | null>(null)
  const [reporForm, setReporForm] = useState({ quantidade: '', motivo: '', data: '' })
  const [reporLoading, setReporLoading] = useState(false)
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null)
  const [detalheProdutoId, setDetalheProdutoId] = useState<string | null>(null)

  // Talhão modal
  const [talhaoModal, setTalhaoModal] = useState(false)
  const [editTalhao, setEditTalhao] = useState<Talhao | null>(null)
  const [talhaoForm, setTalhaoForm] = useState({
    nome: '', area: '', cultura: 'soja' as CulturaType,
    descricao: '', foto: '', latitude: '', longitude: '',
  })
  const [talhaoFotos, setTalhaoFotos] = useState<string[]>([])
  const [talhaoLoading, setTalhaoLoading] = useState(false)

  // Produto modal
  const [produtoModal, setProdutoModal] = useState(false)
  const [editProduto, setEditProduto] = useState<Produto | null>(null)
  const [produtoForm, setProdutoForm] = useState({ nome: '', tipo: 'herbicida' as ProdutoTipo, prazo_medio_aplicacao: '', fabricante: '', quantidade_disponivel: '', unidade_quantidade: 'L', preco_unitario: '' })
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
    if (tals.length > 0) {
      const apps = await db.aplicacoes.where('talhao_id').anyOf(tals.map(t => t.id)).filter(a => !a.deleted_at).toArray()
      setAplicacoes(apps)
    }
    const movs = await db.estoqueMovimentacoes.where('fazenda_id').equals(id).reverse().sortBy('data')
    setMovimentacoes(movs)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // ── Talhão CRUD ──
  function openTalhaoModal(t?: Talhao) {
    setEditTalhao(t || null)
    setTalhaoForm(t
      ? { nome: t.nome, area: t.area.toString(), cultura: t.cultura, descricao: t.descricao || '', foto: t.foto || '', latitude: t.latitude?.toString() || '', longitude: t.longitude?.toString() || '' }
      : { nome: '', area: '', cultura: 'soja', descricao: '', foto: '', latitude: '', longitude: '' }
    )
    setTalhaoFotos(t?.foto ? [t.foto] : [])
    setTalhaoModal(true)
  }

  async function saveTalhao() {
    if (!talhaoForm.nome || !talhaoForm.area) return
    setTalhaoLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const foto = talhaoFotos[0] || undefined
      const base = {
        nome: talhaoForm.nome,
        area: Number(talhaoForm.area),
        cultura: talhaoForm.cultura,
        descricao: talhaoForm.descricao || undefined,
        foto,
        latitude: talhaoForm.latitude ? Number(talhaoForm.latitude) : undefined,
        longitude: talhaoForm.longitude ? Number(talhaoForm.longitude) : undefined,
        updatedAt: now,
      }
      if (editTalhao) {
        const t = { ...editTalhao, ...base }
        await db.talhoes.put(t)
        await enqueueSync('talhao', 'upsert', t as unknown as Record<string, unknown>)
      } else {
        const t: Talhao = { id: gerarId(), fazenda_id: id, createdAt: now, _syncStatus: 'pending', ...base }
        await db.talhoes.add(t)
        await enqueueSync('talhao', 'upsert', t as unknown as Record<string, unknown>)
      }
      processSyncQueue()
      await loadData()
      setTalhaoModal(false)
    } finally { setTalhaoLoading(false) }
  }

  async function deleteTalhao(t: Talhao) {
    if (!confirm(`Excluir talhão "${t.nome}"?`)) return
    await getDB().talhoes.delete(t.id)
    await loadData()
  }

  // ── Produto CRUD ──
  async function saveProduto() {
    if (!produtoForm.nome) return
    setProdutoLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const qtd = produtoForm.quantidade_disponivel ? Number(produtoForm.quantidade_disponivel) : undefined
      const preco = produtoForm.preco_unitario ? Number(produtoForm.preco_unitario) : undefined
      const prazo = produtoForm.prazo_medio_aplicacao ? Number(produtoForm.prazo_medio_aplicacao) : undefined
      if (editProduto) {
        const p = { ...editProduto, nome: produtoForm.nome, tipo: produtoForm.tipo, prazo_medio_aplicacao: prazo, fabricante: produtoForm.fabricante, quantidade_disponivel: qtd, unidade_quantidade: produtoForm.unidade_quantidade || undefined, preco_unitario: preco, updatedAt: now }
        await db.produtos.put(p)
        await enqueueSync('produto', 'upsert', p as unknown as Record<string, unknown>)
        if (qtd !== undefined && qtd !== editProduto.quantidade_disponivel && user) {
          const qtdAnterior = editProduto.quantidade_disponivel ?? 0
          const mov: EstoqueMovimentacao = {
            id: gerarId(), produto_id: editProduto.id, fazenda_id: id, usuario_id: user.id,
            tipo: 'ajuste', quantidade: Math.abs(qtd - qtdAnterior),
            quantidade_anterior: qtdAnterior, quantidade_nova: qtd,
            motivo: 'Ajuste manual no cadastro',
            data: format(new Date(), 'yyyy-MM-dd'), createdAt: new Date().toISOString(),
          }
          await db.estoqueMovimentacoes.add(mov)
          await enqueueSync('estoqueMovimentacao', 'upsert', mov as unknown as Record<string, unknown>)
        }
      } else {
        const p: Produto = { id: gerarId(), nome: produtoForm.nome, tipo: produtoForm.tipo, prazo_medio_aplicacao: prazo, fabricante: produtoForm.fabricante || undefined, quantidade_disponivel: qtd, unidade_quantidade: produtoForm.unidade_quantidade || undefined, preco_unitario: preco, fazenda_id: id, createdAt: now, updatedAt: now, _syncStatus: 'pending' }
        await db.produtos.add(p)
        await enqueueSync('produto', 'upsert', p as unknown as Record<string, unknown>)
      }
      processSyncQueue()
      await loadData()
      setProdutoModal(false)
    } finally { setProdutoLoading(false) }
  }

  async function deleteProduto(p: Produto) {
    if (!confirm(`Excluir produto "${p.nome}"?`)) return
    await getDB().produtos.delete(p.id)
    await loadData()
  }

  // ── Repor Estoque ──
  async function reporEstoque() {
    if (!reporProduto || !user || !reporForm.quantidade) return
    setReporLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const hoje = format(new Date(), 'yyyy-MM-dd')
      const qtdAnterior = reporProduto.quantidade_disponivel ?? 0
      const qtdAdicionada = Number(reporForm.quantidade)
      const qtdNova = qtdAnterior + qtdAdicionada

      const mov: EstoqueMovimentacao = {
        id: gerarId(),
        produto_id: reporProduto.id,
        fazenda_id: id,
        usuario_id: user.id,
        tipo: 'entrada',
        quantidade: qtdAdicionada,
        quantidade_anterior: qtdAnterior,
        quantidade_nova: qtdNova,
        motivo: reporForm.motivo || undefined,
        data: reporForm.data || hoje,
        createdAt: now,
      }
      await db.estoqueMovimentacoes.add(mov)
      await enqueueSync('estoqueMovimentacao', 'upsert', mov as unknown as Record<string, unknown>)

      const updatedProd = { ...reporProduto, quantidade_disponivel: qtdNova, updatedAt: now }
      await db.produtos.put(updatedProd)
      await enqueueSync('produto', 'upsert', updatedProd as unknown as Record<string, unknown>)
      processSyncQueue()

      await loadData()
      setReporModal(false)
      setReporForm({ quantidade: '', motivo: '', data: '' })
    } finally { setReporLoading(false) }
  }

  // ── Talhão coordenadas (map polygon) ──
  async function handleSaveCoords(talhaoId: string, geoJson: string) {
    const db = getDB()
    const now = new Date().toISOString()
    const talhao = talhoes.find(t => t.id === talhaoId)
    if (!talhao) return
    const updated = { ...talhao, coordenadas: geoJson, updatedAt: now, _syncStatus: 'pending' as const }
    await db.talhoes.put(updated)
    await enqueueSync('talhao', 'upsert', updated as unknown as Record<string, unknown>)
    processSyncQueue()
    setTalhoes(prev => prev.map(t => t.id === talhaoId ? { ...t, coordenadas: geoJson } : t))
  }

  // ── PDF ──
  async function exportarPDF() {
    if (!fazenda) return
    setGerandoPDF(true)
    try {
      const { generateAplicacoesReport } = await import('@/lib/reports/pdf-report')
      await generateAplicacoesReport({ fazenda, talhoes, aplicacoes, produtos })
    } finally { setGerandoPDF(false) }
  }

  if (!fazenda) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--fg-subtle)' }}>
      Fazenda não encontrada
    </div>
  )

  // Agendado por produto: soma de dose × area_aplicada das planejadas
  const agendadoPorProduto: Record<string, number> = {}
  for (const a of aplicacoes) {
    if (a.tipo === 'planejada' && a.dose && a.area_aplicada) {
      agendadoPorProduto[a.produto_id] = (agendadoPorProduto[a.produto_id] ?? 0) + a.dose * a.area_aplicada
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'talhoes',    label: 'Talhões',    icon: <Leaf size={14} />,        count: talhoes.length },
    { key: 'mapa',       label: 'Mapa',       icon: <Map size={14} /> },
    { key: 'produtos',   label: 'Produtos',   icon: <Package size={14} />,     count: produtos.length },
    { key: 'financeiro', label: 'Financeiro', icon: <DollarSign size={14} /> },
    { key: 'clima',      label: 'Clima',      icon: <Cloud size={14} /> },
    { key: 'equipe',     label: 'Equipe',     icon: <Users size={14} /> },
  ]

  return (
    <div className="px-4 py-6 md:px-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>{fazenda.nome}</h1>
            </div>
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              {fazenda.localizacao}{fazenda.nome_produtor ? ` · ${fazenda.nome_produtor}` : ''}{fazenda.area_total ? ` · ${fazenda.area_total} ha` : ''}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={exportarPDF}
          loading={gerandoPDF}
          style={{ background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--borda)' }}
          className="gap-1.5 flex-shrink-0"
        >
          <FileText size={13} /> PDF
        </Button>
      </div>

      {/* Tabs */}
      <div className="animate-enter animate-enter-2 flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: 'var(--bg-dark)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow: tab === t.key ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: tab === t.key ? 'hsl(160 84% 22% / 0.12)' : 'transparent', color: tab === t.key ? 'hsl(160 84% 22%)' : 'inherit' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TALHÕES ── */}
      {tab === 'talhoes' && (
        <div className="animate-enter animate-enter-3">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Áreas de cultivo</p>
            <Button size="sm" onClick={() => openTalhaoModal()} className="gap-1">
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
                <div key={t.id} className="card overflow-hidden">
                  {t.foto && (
                    <div className="w-full h-28 overflow-hidden">
                      <img src={t.foto} alt={t.nome} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'var(--verde-50)' }}>
                        {culturaIcon(t.cultura)}
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>{t.nome}</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                          {culturaLabel(t.cultura)} · {t.area} ha
                        </p>
                        {t.descricao && <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--fg-subtle)' }}>{t.descricao}</p>}
                        {t.latitude && t.longitude && (
                          <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--fg-subtle)' }}>
                            <MapPinIcon size={9} /> {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => openTalhaoModal(t)}
                        className="p-1.5 rounded-lg transition" style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTalhao(t)}
                        className="p-1.5 rounded-lg transition" style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 86% 95%)'; e.currentTarget.style.color = 'hsl(0 72% 51%)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <Link href={`/talhoes/${t.id}`}
                    className="flex items-center justify-between px-4 py-2.5 rounded-b-[calc(var(--radius-lg)-1px)] text-sm font-medium transition"
                    style={{ borderTop: '1px solid var(--borda)', color: 'hsl(160 84% 22%)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--verde-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    Gerenciar talhão <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MAPA ── */}
      {tab === 'mapa' && (
        <div className="animate-enter animate-enter-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-label">Mapa dos talhões</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                Visualize e demarcque seus talhões no mapa. Clique em &ldquo;Demarcar talhão&rdquo; para desenhar um polígono.
              </p>
            </div>
            {talhoes.filter(t => t.coordenadas).length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: 'hsl(160 84% 22% / 0.1)', color: 'hsl(160 84% 22%)' }}>
                <MapPinIcon size={11} />
                {talhoes.filter(t => t.coordenadas).length}/{talhoes.length} demarcados
              </div>
            )}
          </div>
          <TalhoesMap
            features={talhoes.map(t => ({
              talhao: t,
              status: (() => {
                const apps = aplicacoes.filter(a => a.talhao_id === t.id)
                if (apps.some(a => a.status === 'atrasado')) return 'atrasado'
                if (apps.some(a => a.status === 'hoje')) return 'hoje'
                if (apps.some(a => a.status === 'proximo')) return 'proximo'
                if (apps.some(a => a.status === 'dentro_do_prazo')) return 'dentro_do_prazo'
                return 'sem_aplicacao'
              })(),
              aplicacoes: aplicacoes.filter(a => a.talhao_id === t.id),
            }))}
            onSaveCoords={handleSaveCoords}
            height="560px"
            fazendaLatitude={fazenda.latitude}
            fazendaLongitude={fazenda.longitude}
            fazendaLocalizacao={fazenda.localizacao}
          />
          {talhoes.length === 0 && (
            <div className="mt-4 card p-6 text-center">
              <Map className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Cadastre talhões na aba &ldquo;Talhões&rdquo; para começar a demarcar no mapa.</p>
            </div>
          )}
        </div>
      )}

      {/* ── FINANCEIRO ── */}
      {tab === 'financeiro' && (() => {
        // Compute cost per application = dose × preco_unitario × area_aplicada
        const appsComCusto = aplicacoes.map(ap => {
          const produto = produtos.find(p => p.id === ap.produto_id)
          const talhao  = talhoes.find(t => t.id === ap.talhao_id)
          const custo = (ap.dose && produto?.preco_unitario && ap.area_aplicada)
            ? ap.dose * produto.preco_unitario * ap.area_aplicada
            : null
          return { ap, produto, talhao, custo }
        })
        const totalGasto    = appsComCusto.reduce((s, i) => s + (i.custo ?? 0), 0)
        const comCusto      = appsComCusto.filter(i => i.custo !== null)
        const semPreco      = produtos.filter(p => !p.preco_unitario).length
        // cost breakdown by product
        const custoPorProd  = produtos.map(p => {
          const soma = appsComCusto.filter(i => i.produto?.id === p.id).reduce((s, i) => s + (i.custo ?? 0), 0)
          return { produto: p, soma }
        }).filter(x => x.soma > 0).sort((a, b) => b.soma - a.soma)

        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

        return (
          <div className="animate-enter animate-enter-3 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="section-label">Módulo financeiro</p>
              {semPreco > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'hsl(38 90% 96%)', color: 'hsl(38 80% 40%)' }}>
                  ⚠ {semPreco} produto{semPreco > 1 ? 's' : ''} sem preço cadastrado
                </span>
              )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Custo total', value: fmt(totalGasto), icon: <Receipt size={15} />, color: 'hsl(160 84% 22%)' },
                { label: 'Aplicações com custo', value: `${comCusto.length}/${aplicacoes.length}`, icon: <FlaskConical size={15} />, color: 'hsl(221 83% 53%)' },
                { label: 'Custo médio/aplicação', value: comCusto.length > 0 ? fmt(totalGasto / comCusto.length) : '—', icon: <TrendingUp size={15} />, color: 'hsl(280 60% 55%)' },
              ].map(k => (
                <div key={k.label} className="card p-4">
                  <div className="flex items-center gap-2 mb-1" style={{ color: k.color }}>
                    {k.icon}
                    <span className="text-[11px] font-semibold uppercase tracking-wide">{k.label}</span>
                  </div>
                  <div className="text-xl font-bold font-display" style={{ color: 'var(--fg)' }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Cost by product */}
            {custoPorProd.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--borda)' }}>
                  <DollarSign size={14} style={{ color: 'hsl(160 84% 22%)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Gasto por produto</span>
                </div>
                <div className="p-4 space-y-3">
                  {custoPorProd.map(({ produto: p, soma }) => {
                    const pct = totalGasto > 0 ? (soma / totalGasto) * 100 : 0
                    return (
                      <div key={p.id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span style={{ color: 'var(--fg)' }}>{p.nome}</span>
                          <span className="font-semibold" style={{ color: 'var(--fg)' }}>{fmt(soma)}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'hsl(160 84% 22%)' }} />
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{pct.toFixed(1)}% do total</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Detailed table */}
            {comCusto.length > 0 ? (
              <div className="card overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--borda)' }}>
                  <Receipt size={14} style={{ color: 'hsl(160 84% 22%)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Custo por aplicação</span>
                </div>
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                  {[...comCusto].sort((a, b) => b.ap.data_aplicacao.localeCompare(a.ap.data_aplicacao)).map(({ ap, produto: p, talhao: t, custo }) => {
                    const [y, mo, d] = ap.data_aplicacao.split('-').map(Number)
                    const dateStr = new Date(y, mo - 1, d).toLocaleDateString('pt-BR')
                    return (
                      <div key={ap.id} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{p?.nome}</div>
                          <div className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                            {t?.nome} · {dateStr}
                            {ap.dose && p && <span> · {ap.dose} {ap.unidade_dose || p.unidade_quantidade || 'un'}/ha × {ap.area_aplicada} ha</span>}
                          </div>
                        </div>
                        <div className="text-sm font-bold flex-shrink-0" style={{ color: 'hsl(160 84% 22%)' }}>
                          {fmt(custo!)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="card p-10 text-center">
                <DollarSign className="w-9 h-9 mx-auto mb-2" style={{ color: 'var(--fg-subtle)', opacity: 0.35 }} />
                <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Nenhum custo calculado ainda</p>
                <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                  Cadastre o <strong>preço unitário</strong> dos produtos e registre aplicações com dose e área para ver os custos aqui.
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── PRODUTOS ── */}
      {tab === 'produtos' && (
        <div className="animate-enter animate-enter-3">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Produtos da fazenda</p>
            <Button size="sm" onClick={() => { setEditProduto(null); setProdutoForm({ nome: '', tipo: 'herbicida', prazo_medio_aplicacao: '', fabricante: '', quantidade_disponivel: '', unidade_quantidade: 'L', preco_unitario: '' }); setProdutoModal(true) }} className="gap-1">
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
              {produtos.map(p => {
                const prodMovs = movimentacoes.filter(m => m.produto_id === p.id).slice(0, 10)
                const isExpanded = expandedProduto === p.id
                return (
                  <div key={p.id} className="card overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(270 60% 96%)' }}>
                          <FlaskConical className="w-4 h-4" style={{ color: 'hsl(270 60% 55%)' }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setDetalheProdutoId(p.id)}
                              className="font-medium text-sm text-left hover:underline"
                              style={{ color: 'var(--fg)' }}
                            >{p.nome}</button>
                            <span className={produtoTipoColor(p.tipo)}>{produtoTipoLabel(p.tipo)}</span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                            {p.fabricante ? `${p.fabricante}` : ''}{p.prazo_medio_aplicacao ? `${p.fabricante ? ' · ' : ''}Sugestão: reaplicar a cada ${p.prazo_medio_aplicacao} dias` : ''}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {p.quantidade_disponivel != null && (
                              <span className="text-xs font-medium" style={{ color: p.quantidade_disponivel <= 5 ? 'hsl(0 72% 45%)' : 'hsl(160 84% 22%)' }}>
                                Estoque: {p.quantidade_disponivel} {p.unidade_quantidade || 'un'}
                              </span>
                            )}
                            {(agendadoPorProduto[p.id] ?? 0) > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'hsl(38 95% 50% / 0.12)', color: 'hsl(38 95% 38%)' }}>
                                {agendadoPorProduto[p.id].toFixed(1)} {p.unidade_quantidade || 'un'} agendado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-0.5 items-center">
                        <button
                          onClick={() => { setReporProduto(p); setReporForm({ quantidade: '', motivo: '', data: '' }); setReporModal(true) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition"
                          style={{ background: 'hsl(160 84% 22% / 0.1)', color: 'hsl(160 84% 22%)' }}
                          title="Repor estoque"
                        >
                          <Plus size={11} /> Repor
                        </button>
                        {prodMovs.length > 0 && (
                          <button
                            onClick={() => setExpandedProduto(isExpanded ? null : p.id)}
                            className="p-1.5 rounded-lg transition"
                            style={{ color: 'var(--fg-subtle)' }}
                            title="Histórico de movimentações"
                          >
                            <History size={14} />
                          </button>
                        )}
                        <button onClick={() => { setEditProduto(p); setProdutoForm({ nome: p.nome, tipo: p.tipo, prazo_medio_aplicacao: p.prazo_medio_aplicacao?.toString() ?? '', fabricante: p.fabricante || '', quantidade_disponivel: p.quantidade_disponivel?.toString() || '', unidade_quantidade: p.unidade_quantidade || 'L', preco_unitario: p.preco_unitario?.toString() || '' }); setProdutoModal(true) }}
                          className="p-1.5 rounded-lg transition" style={{ color: 'var(--fg-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProduto(p)}
                          className="p-1.5 rounded-lg transition" style={{ color: 'var(--fg-subtle)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 86% 95%)'; e.currentTarget.style.color = 'hsl(0 72% 51%)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Movement history */}
                    {isExpanded && prodMovs.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--borda)', background: 'var(--bg)' }}>
                        <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                          <TrendingUp size={12} style={{ color: 'var(--fg-subtle)' }} />
                          <span className="text-[11px] font-semibold section-label">Histórico de movimentações</span>
                        </div>
                        <div className="px-4 pb-3 space-y-2">
                          {prodMovs.map(m => {
                            const [y, mo, d] = m.data.split('-').map(Number)
                            const dateStr = format(new Date(y, mo - 1, d), 'dd/MM/yyyy')
                            const isEntrada = m.tipo === 'entrada'
                            const isSaida = m.tipo === 'saida'
                            const color = isEntrada ? 'hsl(160 84% 22%)' : isSaida ? 'hsl(0 72% 45%)' : 'hsl(210 100% 40%)'
                            const bg = isEntrada ? 'hsl(160 84% 22% / 0.08)' : isSaida ? 'hsl(0 86% 97%)' : 'hsl(210 100% 97%)'
                            return (
                              <div key={m.id} className="flex items-center gap-2 text-[11px]">
                                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                                  {isEntrada ? <ArrowUp size={10} style={{ color }} /> : isSaida ? <ArrowDown size={10} style={{ color }} /> : <ArrowLeftRight size={10} style={{ color }} />}
                                </div>
                                <span style={{ color: 'var(--fg-subtle)', minWidth: '70px' }}>{dateStr}</span>
                                <span className="font-semibold" style={{ color }}>
                                  {isEntrada ? '+' : isSaida ? '-' : '±'}{m.quantidade} {p.unidade_quantidade || 'un'}
                                </span>
                                <span style={{ color: 'var(--fg-subtle)' }}>
                                  {m.quantidade_anterior} → {m.quantidade_nova}
                                </span>
                                {m.motivo && (
                                  <span className="truncate" style={{ color: 'var(--fg-subtle)' }} title={m.motivo}>· {m.motivo}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CLIMA ── */}
      {tab === 'clima' && (
        <div className="animate-enter animate-enter-3">
          <p className="section-label mb-4">Previsão para a região</p>
          <WeatherWidget
            latitude={fazenda.latitude}
            longitude={fazenda.longitude}
            localizacao={fazenda.localizacao}
          />
        </div>
      )}

      {/* ── EQUIPE ── */}
      {tab === 'equipe' && (
        <div className="animate-enter animate-enter-3">
          <MembrosSection fazendaId={id} />
        </div>
      )}

      {/* ── MODAL TALHÃO ── */}
      <Modal
        open={talhaoModal}
        onClose={() => setTalhaoModal(false)}
        title={editTalhao ? 'Editar Talhão' : 'Novo Talhão'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setTalhaoModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={saveTalhao} loading={talhaoLoading} className="flex-1">{editTalhao ? 'Salvar' : 'Criar'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome do talhão" value={talhaoForm.nome} onChange={e => setTalhaoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Talhão 01" />
            <Input label="Área (hectares)" type="number" value={talhaoForm.area} onChange={e => setTalhaoForm(f => ({ ...f, area: e.target.value }))} placeholder="Ex: 50" />
          </div>
          <Select label="Cultura" value={talhaoForm.cultura} onChange={e => setTalhaoForm(f => ({ ...f, cultura: e.target.value as CulturaType }))} options={culturas} />
          <div>
            <label className="field-label">Descrição / Observações</label>
            <textarea
              value={talhaoForm.descricao}
              onChange={e => setTalhaoForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Características do solo, histórico, notas..."
              rows={2}
              className="field-input mt-1 w-full resize-none"
            />
          </div>
          <PhotoPicker
            label="Foto do talhão"
            photos={talhaoFotos}
            onChange={setTalhaoFotos}
            maxPhotos={1}
          />
          <div>
            <p className="field-label mb-2">Localização no mapa</p>
            <TalhaoMap
              latitude={talhaoForm.latitude ? Number(talhaoForm.latitude) : undefined}
              longitude={talhaoForm.longitude ? Number(talhaoForm.longitude) : undefined}
              onLocationSelect={(lat, lng) => setTalhaoForm(f => ({ ...f, latitude: lat.toString(), longitude: lng.toString() }))}
              height="240px"
            />
            {talhaoForm.latitude && talhaoForm.longitude && (
              <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                📍 {Number(talhaoForm.latitude).toFixed(5)}, {Number(talhaoForm.longitude).toFixed(5)}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* ── MODAL DETALHE DO PRODUTO ── */}
      {(() => {
        const p = produtos.find(x => x.id === detalheProdutoId)
        if (!p) return null
        const prodMovs = movimentacoes.filter(m => m.produto_id === p.id)
        const prodApls = aplicacoes.filter(a => a.produto_id === p.id)
        const planejadas = prodApls.filter(a => a.tipo === 'planejada')
        const realizadas = prodApls.filter(a => a.tipo === 'realizada')
        const totalAgendado = planejadas.reduce((acc, a) => acc + (a.dose && a.area_aplicada ? a.dose * a.area_aplicada : 0), 0)
        const totalUsado = prodMovs.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.quantidade, 0)
        const totalEntradas = prodMovs.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.quantidade, 0)
        const valorTotalEntradas = prodMovs
          .filter(m => m.tipo === 'entrada')
          .reduce((acc, m) => acc + m.quantidade * (p.preco_unitario ?? 0), 0)
        const unidade = p.unidade_quantidade || 'un'
        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        return (
          <Modal
            open={!!detalheProdutoId}
            onClose={() => setDetalheProdutoId(null)}
            title={p.nome}
            size="lg"
            footer={
              <Button variant="outline" onClick={() => setDetalheProdutoId(null)} className="w-full">Fechar</Button>
            }
          >
            <div className="space-y-5">
              {/* Identificação */}
              <div>
                <p className="section-label mb-2">Identificação</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                    <span style={{ color: 'var(--fg-subtle)' }}>Tipo</span>
                    <p className="font-semibold mt-0.5" style={{ color: 'var(--fg)' }}>{produtoTipoLabel(p.tipo)}</p>
                  </div>
                  {p.fabricante && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                      <span style={{ color: 'var(--fg-subtle)' }}>Fabricante</span>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--fg)' }}>{p.fabricante}</p>
                    </div>
                  )}
                  {p.registro_mapa && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                      <span style={{ color: 'var(--fg-subtle)' }}>Reg. MAPA</span>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--fg)' }}>{p.registro_mapa}</p>
                    </div>
                  )}
                  {p.prazo_medio_aplicacao && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                      <span style={{ color: 'var(--fg-subtle)' }}>Sugestão reaplicar</span>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--fg)' }}>a cada {p.prazo_medio_aplicacao} dias</p>
                    </div>
                  )}
                  {p.preco_unitario != null && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                      <span style={{ color: 'var(--fg-subtle)' }}>Preço unitário</span>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--fg)' }}>{fmt(p.preco_unitario)}/{unidade}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Estoque */}
              <div>
                <p className="section-label mb-2">Estoque</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="rounded-xl p-3" style={{ background: 'hsl(160 84% 22% / 0.08)' }}>
                    <p className="font-bold text-base" style={{ color: 'hsl(160 84% 22%)' }}>
                      {p.quantidade_disponivel ?? 0} {unidade}
                    </p>
                    <span style={{ color: 'hsl(160 84% 22%)' }}>Disponível</span>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'hsl(38 95% 50% / 0.10)' }}>
                    <p className="font-bold text-base" style={{ color: 'hsl(38 95% 38%)' }}>
                      {totalAgendado > 0 ? totalAgendado.toFixed(1) : '—'} {totalAgendado > 0 ? unidade : ''}
                    </p>
                    <span style={{ color: 'hsl(38 95% 38%)' }}>Agendado</span>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'hsl(0 72% 45% / 0.08)' }}>
                    <p className="font-bold text-base" style={{ color: 'hsl(0 72% 45%)' }}>
                      {totalUsado > 0 ? totalUsado.toFixed(1) : '—'} {totalUsado > 0 ? unidade : ''}
                    </p>
                    <span style={{ color: 'hsl(0 72% 45%)' }}>Usado</span>
                  </div>
                </div>
              </div>

              {/* Aquisições */}
              {prodMovs.filter(m => m.tipo === 'entrada').length > 0 && (
                <div>
                  <p className="section-label mb-2">Aquisições</p>
                  <div className="rounded-xl p-3 text-xs mb-2 flex justify-between" style={{ background: 'var(--bg)' }}>
                    <span style={{ color: 'var(--fg-muted)' }}>Total adquirido</span>
                    <span className="font-semibold" style={{ color: 'var(--fg)' }}>{totalEntradas.toFixed(1)} {unidade}</span>
                  </div>
                  {p.preco_unitario != null && valorTotalEntradas > 0 && (
                    <div className="rounded-xl p-3 text-xs flex justify-between" style={{ background: 'var(--bg)' }}>
                      <span style={{ color: 'var(--fg-muted)' }}>Valor total investido</span>
                      <span className="font-semibold" style={{ color: 'var(--fg)' }}>{fmt(valorTotalEntradas)}</span>
                    </div>
                  )}
                  <div className="space-y-1.5 mt-2">
                    {prodMovs.filter(m => m.tipo === 'entrada').map(m => {
                      const [y, mo, d] = m.data.split('-').map(Number)
                      const dateStr = format(new Date(y, mo - 1, d), 'dd/MM/yyyy')
                      return (
                        <div key={m.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl"
                          style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}>
                          <div>
                            <span className="font-medium" style={{ color: 'var(--fg)' }}>+{m.quantidade} {unidade}</span>
                            {m.motivo && <span className="ml-1.5" style={{ color: 'var(--fg-subtle)' }}>· {m.motivo}</span>}
                          </div>
                          <div className="text-right" style={{ color: 'var(--fg-subtle)' }}>
                            <div>{dateStr}</div>
                            {p.preco_unitario != null && (
                              <div className="font-medium" style={{ color: 'var(--fg-muted)' }}>{fmt(m.quantidade * p.preco_unitario)}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Aplicações agendadas */}
              {planejadas.length > 0 && (
                <div>
                  <p className="section-label mb-2">Aplicações agendadas ({planejadas.length})</p>
                  <div className="space-y-1.5">
                    {planejadas.map(a => {
                      const t = talhoes.find(t => t.id === a.talhao_id)
                      const [y, mo, d] = a.data_aplicacao.split('-').map(Number)
                      return (
                        <div key={a.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl"
                          style={{ background: 'hsl(38 95% 50% / 0.07)', border: '1px solid hsl(38 95% 50% / 0.2)' }}>
                          <div>
                            <span className="font-medium" style={{ color: 'var(--fg)' }}>{t?.nome ?? 'Talhão'}</span>
                            {a.dose && a.area_aplicada && (
                              <span className="ml-1.5" style={{ color: 'var(--fg-subtle)' }}>
                                · {a.dose} {a.unidade_dose || unidade}/ha × {a.area_aplicada} ha = {(a.dose * a.area_aplicada).toFixed(1)} {unidade}
                              </span>
                            )}
                          </div>
                          <span style={{ color: 'hsl(38 95% 38%)' }}>{format(new Date(y, mo - 1, d), 'dd/MM/yyyy')}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Aplicações realizadas */}
              {realizadas.length > 0 && (
                <div>
                  <p className="section-label mb-2">Aplicações realizadas ({realizadas.length})</p>
                  <div className="space-y-1.5">
                    {realizadas.map(a => {
                      const t = talhoes.find(t => t.id === a.talhao_id)
                      const [y, mo, d] = a.data_aplicacao.split('-').map(Number)
                      return (
                        <div key={a.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl"
                          style={{ background: 'hsl(160 84% 22% / 0.06)', border: '1px solid hsl(160 84% 22% / 0.15)' }}>
                          <div>
                            <span className="font-medium" style={{ color: 'var(--fg)' }}>{t?.nome ?? 'Talhão'}</span>
                            {a.dose && a.area_aplicada && (
                              <span className="ml-1.5" style={{ color: 'var(--fg-subtle)' }}>
                                · {a.dose} {a.unidade_dose || unidade}/ha × {a.area_aplicada} ha
                              </span>
                            )}
                          </div>
                          <span style={{ color: 'hsl(160 84% 22%)' }}>{format(new Date(y, mo - 1, d), 'dd/MM/yyyy')}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {prodApls.length === 0 && prodMovs.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--fg-subtle)' }}>
                  Nenhuma movimentação ou aplicação registrada ainda.
                </p>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* ── MODAL REPOR ESTOQUE ── */}
      <Modal
        open={reporModal}
        onClose={() => setReporModal(false)}
        title={`Repor Estoque — ${reporProduto?.nome}`}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setReporModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={reporEstoque} loading={reporLoading} disabled={!reporForm.quantidade} className="flex-1">Confirmar Entrada</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {reporProduto && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'hsl(160 84% 22% / 0.08)', color: 'hsl(160 84% 22%)' }}>
              Estoque atual: <strong>{reporProduto.quantidade_disponivel ?? 0} {reporProduto.unidade_quantidade || 'un'}</strong>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantidade a adicionar" type="number" value={reporForm.quantidade} onChange={e => setReporForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="Ex: 100" />
            <Input label="Data de entrada" type="date" value={reporForm.data} onChange={e => setReporForm(f => ({ ...f, data: e.target.value }))} />
          </div>
          <Input label="Motivo / Nota fiscal (opcional)" value={reporForm.motivo} onChange={e => setReporForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Compra NF 12345" />
        </div>
      </Modal>

      {/* ── MODAL PRODUTO ── */}
      <Modal
        open={produtoModal}
        onClose={() => setProdutoModal(false)}
        title={editProduto ? 'Editar Produto' : 'Novo Produto'}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setProdutoModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={saveProduto} loading={produtoLoading} className="flex-1">{editProduto ? 'Salvar' : 'Criar'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Nome do produto" value={produtoForm.nome} onChange={e => setProdutoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Glifosato 360" />
          <Select label="Tipo" value={produtoForm.tipo} onChange={e => setProdutoForm(f => ({ ...f, tipo: e.target.value as ProdutoTipo }))} options={tiposProduto} />
          <Input label="Prazo médio de reaplicação (dias) — opcional, informativo" type="number" value={produtoForm.prazo_medio_aplicacao} onChange={e => setProdutoForm(f => ({ ...f, prazo_medio_aplicacao: e.target.value }))} placeholder="Ex: 21 (sugestão)" />
          <Input label="Fabricante (opcional)" value={produtoForm.fabricante} onChange={e => setProdutoForm(f => ({ ...f, fabricante: e.target.value }))} placeholder="Ex: Bayer" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantidade disponível" type="number" value={produtoForm.quantidade_disponivel} onChange={e => setProdutoForm(f => ({ ...f, quantidade_disponivel: e.target.value }))} placeholder="Ex: 200" />
            <Select label="Unidade" value={produtoForm.unidade_quantidade} onChange={e => setProdutoForm(f => ({ ...f, unidade_quantidade: e.target.value }))} options={[
              { value: 'L', label: 'Litros (L)' },
              { value: 'kg', label: 'Quilos (kg)' },
              { value: 'g', label: 'Gramas (g)' },
              { value: 'ml', label: 'Mililitros (ml)' },
              { value: 'sc', label: 'Sacas (sc)' },
              { value: 'un', label: 'Unidades (un)' },
            ]} />
          </div>
          <Input label="Preço unitário (R$/un) — para módulo financeiro" type="number" value={produtoForm.preco_unitario} onChange={e => setProdutoForm(f => ({ ...f, preco_unitario: e.target.value }))} placeholder="Ex: 45.90" />
        </div>
      </Modal>
    </div>
  )
}
