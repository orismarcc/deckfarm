'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { gerarId } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  ClipboardList,
  Trash2,
  Check,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  format,
  parseISO,
  isBefore,
  isToday,
  isPast,
  differenceInDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  Fazenda,
  Talhao,
  Produto,
  Aplicacao,
  Recomendacao,
  RecomendacaoAplicacao,
  AplicacaoStatus,
} from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcStatus(data: string): AplicacaoStatus {
  const d = parseISO(data)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (isToday(d)) return 'hoje'
  if (isPast(d)) return 'atrasado'
  const diff = differenceInDays(d, hoje)
  return diff <= 7 ? 'proximo' : 'dentro_do_prazo'
}

function fmtDate(iso: string) {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
}

function isAtiva(rec: Recomendacao): boolean {
  return !isBefore(parseISO(rec.data_fim), new Date())
}

// ── Types for local modal state ───────────────────────────────────────────────

interface TalhaoProdutoEntry {
  produto_id: string
  selected: boolean       // usuário deve selecionar explicitamente
  data_aplicacao: string
  dose: string
  unidade_dose: string
}

interface TalhaoEntry {
  talhao_id: string
  selected: boolean
  expanded: boolean
  produtos: TalhaoProdutoEntry[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecomendacoesPage() {
  const { user } = useAuthStore()

  // data
  const [recomendacoes, setRecomendacoes] = useState<Recomendacao[]>([])
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [talhoesByFazenda, setTalhoesByFazenda] = useState<Record<string, Talhao[]>>({})
  const [produtosByFazenda, setProdutosByFazenda] = useState<Record<string, Produto[]>>({})
  const [contagens, setContagens] = useState<Record<string, { talhoes: number; produtos: number }>>({})
  const [loading, setLoading] = useState(true)

  // modal
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // form
  const [fazendaId, setFazendaId] = useState('')
  const [nome, setNome] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [talhaoEntries, setTalhaoEntries] = useState<TalhaoEntry[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const fazs = await db.fazendas.where('usuario_id').equals(user.id).toArray()
      setFazendas(fazs)

      const recs = await db.recomendacoes
        .where('usuario_id')
        .equals(user.id)
        .reverse()
        .sortBy('createdAt')
      setRecomendacoes(recs)

      // Pre-load talhões and produtos per fazenda
      const tMap: Record<string, Talhao[]> = {}
      const pMap: Record<string, Produto[]> = {}
      for (const faz of fazs) {
        tMap[faz.id] = await db.talhoes.where('fazenda_id').equals(faz.id).toArray()
        pMap[faz.id] = await db.produtos.where('fazenda_id').equals(faz.id).toArray()
      }
      setTalhoesByFazenda(tMap)
      setProdutosByFazenda(pMap)

      // Compute counts per recomendação
      const cnt: Record<string, { talhoes: number; produtos: number }> = {}
      for (const rec of recs) {
        const apls = await db.recomendacaoAplicacoes
          .where('recomendacao_id')
          .equals(rec.id)
          .toArray()
        const talhaoIds = new Set(apls.map(a => a.talhao_id))
        const produtoIds = new Set(apls.map(a => a.produto_id))
        cnt[rec.id] = { talhoes: talhaoIds.size, produtos: produtoIds.size }
      }
      setContagens(cnt)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Fazenda selection: rebuild talhão entries ─────────────────────────────

  function handleFazendaChange(fid: string) {
    setFazendaId(fid)
    setErrors({})
    if (!fid) {
      setTalhaoEntries([])
      return
    }
    const talhoes = talhoesByFazenda[fid] ?? []
    const produtos = produtosByFazenda[fid] ?? []
    setTalhaoEntries(
      talhoes.map(t => ({
        talhao_id: t.id,
        selected: false,
        expanded: false,
        // Produtos iniciam desmarcados — o usuário seleciona explicitamente
        produtos: produtos.map(p => ({
          produto_id: p.id,
          selected: false,
          data_aplicacao: '',
          dose: '',
          unidade_dose: '',
        })),
      }))
    )
  }

  function toggleTalhao(idx: number) {
    setTalhaoEntries(prev =>
      prev.map((e, i) =>
        i !== idx ? e : { ...e, selected: !e.selected, expanded: !e.selected }
      )
    )
  }

  function toggleExpand(idx: number) {
    setTalhaoEntries(prev =>
      prev.map((e, i) => (i !== idx ? e : { ...e, expanded: !e.expanded }))
    )
  }

  // Seleciona/deseleciona um produto de forma explícita por talhão
  function toggleProduto(talhaoIdx: number, prodIdx: number) {
    setTalhaoEntries(prev =>
      prev.map((e, i) => {
        if (i !== talhaoIdx) return e
        const produtos = e.produtos.map((p, pi) => {
          if (pi !== prodIdx) return p
          const nowSelected = !p.selected
          return {
            ...p,
            selected: nowSelected,
            // Pré-preenche a data com dataInicio ao selecionar; limpa ao desmarcar
            data_aplicacao: nowSelected ? (dataInicio || '') : '',
          }
        })
        return { ...e, produtos }
      })
    )
  }

  function setProdutoField(
    talhaoIdx: number,
    prodIdx: number,
    field: keyof TalhaoProdutoEntry,
    value: string
  ) {
    setTalhaoEntries(prev =>
      prev.map((e, i) => {
        if (i !== talhaoIdx) return e
        const produtos = e.produtos.map((p, pi) =>
          pi !== prodIdx ? p : { ...p, [field]: value }
        )
        return { ...e, produtos }
      })
    )
  }

  // ── Modal open / close ────────────────────────────────────────────────────

  function openModal() {
    setFazendaId('')
    setNome('')
    setDataInicio('')
    setDataFim('')
    setObservacoes('')
    setTalhaoEntries([])
    setErrors({})
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!fazendaId) e.fazendaId = 'Selecione uma fazenda'
    if (!nome.trim()) e.nome = 'Informe um nome'
    if (!dataInicio) e.dataInicio = 'Informe a data de início'
    if (!dataFim) e.dataFim = 'Informe a data de fim'
    if (dataInicio && dataFim && dataFim < dataInicio)
      e.dataFim = 'Data de fim deve ser após a de início'
    const selectedTalhoes = talhaoEntries.filter(e => e.selected)
    if (selectedTalhoes.length === 0) e.talhoes = 'Selecione ao menos um talhão'
    for (const te of selectedTalhoes) {
      for (const pe of te.produtos) {
        if (pe.data_aplicacao) {
          if (pe.data_aplicacao < dataInicio || pe.data_aplicacao > dataFim) {
            e[`data_${te.talhao_id}_${pe.produto_id}`] =
              'Data fora do período da recomendação'
          }
        }
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!validate() || !user) return
    setSaving(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const recId = gerarId()

      // 1. Create Recomendacao
      const rec: Recomendacao = {
        id: recId,
        fazenda_id: fazendaId,
        usuario_id: user.id,
        nome: nome.trim(),
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacoes: observacoes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await db.recomendacoes.add(rec)

      const selectedTalhoes = talhaoEntries.filter(te => te.selected)

      // For each (talhão, produto) pair that has a date set
      const recApls: RecomendacaoAplicacao[] = []
      const aplicacoes: Aplicacao[] = []

      for (const te of selectedTalhoes) {
        // Apenas produtos explicitamente selecionados pelo usuário
        const produtosSelecionados = te.produtos.filter(pe => pe.selected && pe.data_aplicacao)
        for (const pe of produtosSelecionados) {
          const aplDate = pe.data_aplicacao

          // 2. RecomendacaoAplicacao record
          const recApl: RecomendacaoAplicacao = {
            id: gerarId(),
            recomendacao_id: recId,
            talhao_id: te.talhao_id,
            produto_id: pe.produto_id,
            data_aplicacao: aplDate,
            dose: pe.dose ? parseFloat(pe.dose) : undefined,
            unidade_dose: pe.unidade_dose || undefined,
            createdAt: now,
          }
          recApls.push(recApl)

          // 3. Aplicacao (tipo='planejada')
          // proxima_aplicacao não é calculada automaticamente — campo é apenas sugestivo
          const apl: Aplicacao = {
            id: gerarId(),
            talhao_id: te.talhao_id,
            produto_id: pe.produto_id,
            tipo: 'planejada',
            data_aplicacao: aplDate,
            // proxima_aplicacao omitida: prazo médio é apenas informativo, não lógica de negócio
            status: calcStatus(aplDate),
            dose: pe.dose ? parseFloat(pe.dose) : undefined,
            unidade_dose: pe.unidade_dose || undefined,
            observacoes: `Recomendação técnica: ${nome.trim()}`,
            usuario_id: user.id,
            createdAt: now,
            updatedAt: now,
            _syncStatus: 'pending',
          }
          aplicacoes.push(apl)
        }
      }

      await db.recomendacaoAplicacoes.bulkAdd(recApls)
      await db.aplicacoes.bulkAdd(aplicacoes)

      setModalOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(rec: Recomendacao) {
    if (!confirm(`Excluir a recomendação "${rec.nome}"? As aplicações planejadas associadas também serão removidas.`))
      return
    const db = getDB()
    // Remove recomendacaoAplicacoes
    const apls = await db.recomendacaoAplicacoes
      .where('recomendacao_id')
      .equals(rec.id)
      .toArray()
    await db.recomendacaoAplicacoes.bulkDelete(apls.map(a => a.id))
    // Remove planejadas tagged with this recomendação
    const obs = `Recomendação técnica: ${rec.nome}`
    const planejadas = await db.aplicacoes
      .filter(a => a.tipo === 'planejada' && a.observacoes === obs)
      .toArray()
    await db.aplicacoes.bulkDelete(planejadas.map(a => a.id))
    await db.recomendacoes.delete(rec.id)
    await loadData()
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const fazendaOptions = [
    { value: '', label: 'Selecione a fazenda...' },
    ...fazendas.map(f => ({ value: f.id, label: f.nome })),
  ]

  const selectedFazenda = fazendas.find(f => f.id === fazendaId)
  const talhoesCurrent = talhoesByFazenda[fazendaId] ?? []
  const produtosCurrent = produtosByFazenda[fazendaId] ?? []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="animate-enter-1 mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="section-label mb-1">Agrônomo</p>
          <h1 className="font-display text-[2rem] font-bold" style={{ color: 'var(--fg)' }}>
            Recomendações Técnicas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            Cronograma técnico do agrônomo
          </p>
        </div>
        <Button onClick={openModal} className="flex-shrink-0 mt-1">
          <Plus className="w-4 h-4" />
          Nova Recomendação
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--fg-subtle)' }}>
          Carregando...
        </div>
      ) : recomendacoes.length === 0 ? (
        <div className="card animate-enter-3 p-14 text-center">
          <div className="icon-circle icon-circle-muted w-14 h-14 mx-auto mb-4">
            <ClipboardList size={22} />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>
            Nenhuma recomendação cadastrada
          </p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Crie a primeira recomendação técnica para seus talhões.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recomendacoes.map((rec, i) => {
            const ativa = isAtiva(rec)
            const faz = fazendas.find(f => f.id === rec.fazenda_id)
            const cnt = contagens[rec.id] ?? { talhoes: 0, produtos: 0 }
            return (
              <div
                key={rec.id}
                className="card p-5 animate-enter"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: ativa
                        ? 'hsl(160 84% 22% / 0.12)'
                        : 'var(--bg-dark)',
                    }}
                  >
                    <ClipboardList
                      size={18}
                      style={{ color: ativa ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)' }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-semibold text-sm truncate"
                        style={{ color: 'var(--fg)' }}
                      >
                        {rec.nome}
                      </span>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: ativa
                            ? 'hsl(160 84% 22% / 0.12)'
                            : 'var(--bg-dark)',
                          color: ativa ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
                        }}
                      >
                        {ativa ? 'Ativa' : 'Encerrada'}
                      </span>
                    </div>

                    {faz && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                        {faz.nome}
                      </p>
                    )}

                    <div
                      className="flex items-center gap-1 mt-1.5 text-xs"
                      style={{ color: 'var(--fg-subtle)' }}
                    >
                      <Calendar size={11} />
                      <span>
                        {fmtDate(rec.data_inicio)} — {fmtDate(rec.data_fim)}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-3 mt-2 text-xs"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      <span>{cnt.talhoes} talhão{cnt.talhoes !== 1 ? 'ões' : ''}</span>
                      <span style={{ color: 'var(--borda)' }}>·</span>
                      <span>{cnt.produtos} produto{cnt.produtos !== 1 ? 's' : ''}</span>
                    </div>

                    {rec.observacoes && (
                      <p
                        className="text-xs mt-2 line-clamp-2"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {rec.observacoes}
                      </p>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(rec)}
                    className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--fg-subtle)' }}
                    title="Excluir recomendação"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Nova Recomendação"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              <Check className="w-4 h-4" />
              Salvar Recomendação
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Fazenda */}
          <div>
            <Select
              label="Fazenda"
              value={fazendaId}
              onChange={e => handleFazendaChange(e.target.value)}
              options={fazendaOptions}
              error={errors.fazendaId}
            />
          </div>

          {/* Nome */}
          <Input
            label="Nome da Recomendação"
            placeholder="Ex: Aplicação pré-plantio soja"
            value={nome}
            onChange={e => setNome(e.target.value)}
            error={errors.nome}
          />

          {/* Período */}
          <div>
            <p className="section-label mb-2">Período</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Data de Início"
                type="date"
                value={dataInicio}
                onChange={e => {
                  setDataInicio(e.target.value)
                  // Propaga para produtos selecionados que ainda não tiveram a data customizada
                  setTalhaoEntries(prev =>
                    prev.map(te => ({
                      ...te,
                      produtos: te.produtos.map(p =>
                        // Só atualiza se selecionado E se a data é vazia ou ainda é a data-início anterior
                        p.selected && (!p.data_aplicacao || p.data_aplicacao === dataInicio)
                          ? { ...p, data_aplicacao: e.target.value }
                          : p
                      ),
                    }))
                  )
                }}
                error={errors.dataInicio}
              />
              <Input
                label="Data de Fim"
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                error={errors.dataFim}
              />
            </div>
          </div>

          {/* Talhões */}
          {fazendaId && (
            <div>
              <p className="section-label mb-2">Talhões</p>
              {errors.talhoes && (
                <p className="text-xs text-red-500 font-medium mb-2">{errors.talhoes}</p>
              )}
              {talhoesCurrent.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  Nenhum talhão cadastrado nesta fazenda.
                </p>
              ) : (
                <div className="space-y-2">
                  {talhaoEntries.map((te, tIdx) => {
                    const talhao = talhoesCurrent.find(t => t.id === te.talhao_id)
                    if (!talhao) return null
                    return (
                      <div
                        key={te.talhao_id}
                        className="rounded-xl border"
                        style={{ borderColor: te.selected ? 'hsl(160 84% 22% / 0.4)' : 'var(--borda)' }}
                      >
                        {/* Talhão header row */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer rounded-xl"
                          style={{
                            background: te.selected ? 'hsl(160 84% 22% / 0.06)' : 'var(--bg-dark)',
                          }}
                          onClick={() => toggleTalhao(tIdx)}
                        >
                          {/* Checkbox */}
                          <div
                            className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                            style={{
                              borderColor: te.selected ? 'hsl(160 84% 22%)' : 'var(--borda)',
                              background: te.selected ? 'hsl(160 84% 22%)' : 'transparent',
                            }}
                          >
                            {te.selected && <Check size={11} color="white" strokeWidth={3} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span
                              className="text-sm font-medium"
                              style={{ color: 'var(--fg)' }}
                            >
                              {talhao.nome}
                            </span>
                            <span
                              className="ml-2 text-xs"
                              style={{ color: 'var(--fg-subtle)' }}
                            >
                              {talhao.area} ha
                            </span>
                          </div>

                          {te.selected && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                toggleExpand(tIdx)
                              }}
                              className="p-1"
                              style={{ color: 'var(--fg-subtle)' }}
                            >
                              {te.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </div>

                        {/* Products sub-section */}
                        {te.selected && te.expanded && (
                          <div className="px-4 pb-4 pt-2 space-y-3">
                            {produtosCurrent.length === 0 ? (
                              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                                Nenhum produto cadastrado nesta fazenda.
                              </p>
                            ) : (
                              <>
                                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                                  Selecione os produtos que deseja incluir neste talhão:
                                </p>
                                {produtosCurrent.map((prod, pIdx) => {
                                  const pe = te.produtos[pIdx]
                                  if (!pe) return null
                                  const dateKey = `data_${te.talhao_id}_${prod.id}`
                                  return (
                                    <div
                                      key={prod.id}
                                      className="rounded-xl overflow-hidden"
                                      style={{
                                        border: pe.selected
                                          ? '1.5px solid hsl(160 84% 22% / 0.45)'
                                          : '1px solid var(--borda)',
                                      }}
                                    >
                                      {/* Cabeçalho do produto com checkbox de seleção */}
                                      <div
                                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                                        style={{
                                          background: pe.selected
                                            ? 'hsl(160 84% 22% / 0.06)'
                                            : 'var(--bg)',
                                        }}
                                        onClick={() => toggleProduto(tIdx, pIdx)}
                                      >
                                        <div
                                          className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                                          style={{
                                            borderColor: pe.selected
                                              ? 'hsl(160 84% 22%)'
                                              : 'var(--borda)',
                                            background: pe.selected
                                              ? 'hsl(160 84% 22%)'
                                              : 'transparent',
                                          }}
                                        >
                                          {pe.selected && (
                                            <Check size={9} color="white" strokeWidth={3} />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span
                                            className="text-xs font-semibold"
                                            style={{
                                              color: pe.selected
                                                ? 'hsl(160 84% 22%)'
                                                : 'var(--fg)',
                                            }}
                                          >
                                            {prod.nome}
                                          </span>
                                          <span
                                            className="ml-2 text-[10px]"
                                            style={{ color: 'var(--fg-subtle)' }}
                                          >
                                            {prod.tipo}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Campos de configuração — visíveis apenas quando selecionado */}
                                      {pe.selected && (
                                        <div
                                          className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-3 pb-3 pt-2"
                                          style={{ background: 'var(--bg-card)' }}
                                        >
                                          <Input
                                            label="Data de Aplicação"
                                            type="date"
                                            value={pe.data_aplicacao}
                                            min={dataInicio}
                                            max={dataFim}
                                            onChange={e =>
                                              setProdutoField(
                                                tIdx,
                                                pIdx,
                                                'data_aplicacao',
                                                e.target.value
                                              )
                                            }
                                            error={errors[dateKey]}
                                          />
                                          <Input
                                            label="Dose"
                                            type="number"
                                            placeholder="Ex: 2.5"
                                            value={pe.dose}
                                            onChange={e =>
                                              setProdutoField(tIdx, pIdx, 'dose', e.target.value)
                                            }
                                          />
                                          <Input
                                            label="Unidade"
                                            placeholder="Ex: L/ha"
                                            value={pe.unidade_dose}
                                            onChange={e =>
                                              setProdutoField(
                                                tIdx,
                                                pIdx,
                                                'unidade_dose',
                                                e.target.value
                                              )
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          <Textarea
            label="Observações"
            placeholder="Notas técnicas, condições especiais..."
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </div>
  )
}
