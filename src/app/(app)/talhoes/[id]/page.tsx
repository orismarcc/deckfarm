'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { criarAplicacao, atualizarStatuses } from '@/lib/db/aplicacoes'
import { agendarAplicacoesPorPlantio, criarOuAtualizarSafra, CICLO_CULTURA } from '@/lib/db/agronomo'
import { enqueueSync, processSyncQueue } from '@/lib/db/sync'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { FenologiaCard } from '@/components/talhoes/fenologia-card'
import { culturaLabel, culturaIcon, gerarId } from '@/lib/utils'
import type { Talhao, Fazenda, Produto, Aplicacao, Pluviometro, RegistroChuva, Anotacao, StatusSemeadura, Recomendacao, RecomendacaoAplicacao, SemeaduraEtapa, MonitoramentoPraga, CulturaType } from '@/types'
import { PhotoPicker } from '@/components/ui/photo-picker'
import {
  ArrowLeft, Plus, FlaskConical, AlertTriangle, Calendar,
  Sprout, CheckCircle2, Clock3, ChevronDown, ChevronUp, Pencil, RotateCcw,
  CloudRain, StickyNote, Droplets, Layers, Trash2, Bug,
} from 'lucide-react'
import Link from 'next/link'
import { addDays, differenceInDays, parseISO, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MonitoramentoTimeline } from '@/components/monitoramento/monitoramento-timeline'
import { MonitoramentoModal } from '@/components/monitoramento/monitoramento-modal'
import { TendenciaAlerta } from '@/components/monitoramento/monitoramento-alertas'
import { SeveridadeDot, worstSeveridade } from '@/components/ui/severidade-badge'

// ── Crop phases (approximate %) ─────────────────────────────────────────────
function getCropPhase(pct: number): { label: string; color: string } {
  if (pct < 0)   return { label: 'Pré-plantio', color: 'hsl(38 70% 45%)' }
  if (pct < 20)  return { label: 'Germinação', color: 'hsl(90 55% 35%)' }
  if (pct < 50)  return { label: 'Vegetativo', color: 'hsl(130 55% 30%)' }
  if (pct < 75)  return { label: 'Reprodutivo', color: 'hsl(160 70% 28%)' }
  if (pct < 95)  return { label: 'Maturação', color: 'hsl(38 90% 38%)' }
  return { label: 'Colheita', color: 'hsl(32 95% 35%)' }
}

const STATUS_SEMEADURA_LABELS: Record<StatusSemeadura, string> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
}

const STATUS_SEMEADURA_COLORS: Record<StatusSemeadura, { color: string; bg: string }> = {
  nao_iniciada: { color: 'hsl(32 95% 38%)', bg: 'hsl(32 95% 38% / 0.1)' },
  em_andamento: { color: 'hsl(210 100% 40%)', bg: 'hsl(210 100% 40% / 0.1)' },
  finalizada:   { color: 'hsl(160 84% 22%)', bg: 'hsl(160 84% 22% / 0.1)' },
}

// format() from date-fns uses LOCAL time → correct local date, no UTC-offset X-1 bug
const TODAY = format(new Date(), 'yyyy-MM-dd')

function calcularStatusLocal(proxima: string): Aplicacao['status'] {
  const [y, m, d] = proxima.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const diff = Math.round((dt.getTime() - hoje.getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff < 0) return 'atrasado'
  if (diff <= 7) return 'proximo'
  return 'dentro_do_prazo'
}

/** Portuguese ordinal for a sowing stage: 1 → "1ª", 2 → "2ª", etc. */
function etapaOrdinal(n: number): string { return `${n}ª etapa` }

// ── Notificações de semeadura e colheita ─────────────────────────────────────
async function gerarNotificacoesSemeadura(talhao: Talhao, usuario_id: string): Promise<void> {
  if (!talhao.data_plantio) return
  const db = getDB()
  const now = new Date().toISOString()

  // Remove notificações antigas de plantio/colheita deste talhão que não sejam de aplicação
  const antigas = await db.notificacoes
    .where('talhao_id').equals(talhao.id)
    .and(n => !n.aplicacao_id)
    .toArray()
  for (const n of antigas) await db.notificacoes.delete(n.id)

  // Notificação para data de plantio
  await db.notificacoes.add({
    id: gerarId(),
    tipo: 'hoje',
    mensagem: `Plantio do talhão "${talhao.nome}" registrado para ${talhao.data_plantio}`,
    data_referencia: talhao.data_plantio,
    lida: false,
    usuario_id,
    talhao_id: talhao.id,
    fazenda_id: talhao.fazenda_id,
    createdAt: now,
  })

  // Notificação de colheita prevista (7 dias antes e 1 dia antes)
  if (talhao.data_colheita_prevista) {
    const colheita = parseISO(talhao.data_colheita_prevista)
    await db.notificacoes.add({
      id: gerarId(),
      tipo: 'semana',
      mensagem: `Colheita prevista para o talhão "${talhao.nome}" em uma semana`,
      data_referencia: format(addDays(colheita, -7), 'yyyy-MM-dd'),
      lida: false,
      usuario_id,
      talhao_id: talhao.id,
      fazenda_id: talhao.fazenda_id,
      createdAt: now,
    })
    await db.notificacoes.add({
      id: gerarId(),
      tipo: 'amanha',
      mensagem: `Colheita do talhão "${talhao.nome}" prevista para amanhã`,
      data_referencia: format(addDays(colheita, -1), 'yyyy-MM-dd'),
      lida: false,
      usuario_id,
      talhao_id: talhao.id,
      fazenda_id: talhao.fazenda_id,
      createdAt: now,
    })
  }
}

type TalhaoTab = 'info' | 'monitoramento'

export default function TalhaoPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const [talhao, setTalhao] = useState<Talhao | null>(null)
  const [fazenda, setFazenda] = useState<Fazenda | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])

  // ── Monitoramento state ───────────────────────────────────────────────────
  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoPraga[]>([])
  const [monitoramentoModal, setMonitoramentoModal] = useState(false)
  const [editingMonitoramento, setEditingMonitoramento] = useState<MonitoramentoPraga | null>(null)
  const [activeTab, setActiveTab] = useState<TalhaoTab>(
    () => (searchParams.get('tab') === 'monitoramento' ? 'monitoramento' : 'info')
  )

  // Semeadura etapas
  const [etapas, setEtapas] = useState<SemeaduraEtapa[]>([])
  const [etapaModal, setEtapaModal] = useState(false)
  const [etapaForm, setEtapaForm] = useState({ area_semeada: '', data_semeadura: TODAY, observacoes: '' })
  const [etapaLoading, setEtapaLoading] = useState(false)
  const [etapaError, setEtapaError] = useState('')

  // Plantio modal
  const [plantioModal, setPlantioModal] = useState(false)
  const [plantioForm, setPlantioForm] = useState({
    data_plantio: '',
    data_colheita_prevista: '',
    status_semeadura: '' as StatusSemeadura | '',
    area_semeada: '',
  })
  const [plantioLoading, setPlantioLoading] = useState(false)

  // Aplicação modal
  const [modalOpen, setModalOpen] = useState(false)
  const [aplicacaoBase, setAplicacaoBase] = useState<Partial<Aplicacao> | null>(null)
  const [modalMode, setModalMode] = useState<'produto' | 'recomendacao'>('produto')
  const [recomendacoes, setRecomendacoes] = useState<Recomendacao[]>([])
  const [selectedRecomendacaoId, setSelectedRecomendacaoId] = useState('')
  const [form, setForm] = useState({
    produto_id: '',
    data_aplicacao: TODAY,
    dose: '',
    unidade_dose: 'L/ha',
    area_aplicada: '',
    observacoes: '',
    clima: '',
    temperatura: '',
    tipo: 'planejada' as 'planejada' | 'realizada',
  })
  const [fotos, setFotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [editingAplicacao, setEditingAplicacao] = useState<Aplicacao | null>(null)
  const [deletingApId, setDeletingApId] = useState<string | null>(null)
  // "Marcar como Realizada" inline flow: click → date input appears → confirm
  const [marcarRealizadaId, setMarcarRealizadaId] = useState<string | null>(null)
  const [marcarRealizadaDate, setMarcarRealizadaDate] = useState(TODAY)

  // UI state
  const [showPlanned, setShowPlanned] = useState(true)
  const [showHistory, setShowHistory] = useState(true)

  // ── Pluviometria state ────────────────────────────────────────────────────
  const [pluviometro, setPluviometro] = useState<Pluviometro | null>(null)
  const [registrosChuva, setRegistrosChuva] = useState<RegistroChuva[]>([])
  const [configurandoPluviometro, setConfigurandoPluviometro] = useState(false)
  const [pluvioNome, setPluvioNome] = useState('')
  const [pluvioLoading, setPluvioLoading] = useState(false)
  const [showChuvaForm, setShowChuvaForm] = useState(false)
  const [chuvaForm, setChuvaForm] = useState({ data: TODAY, volume_mm: '' })
  const [chuvaLoading, setChuvaLoading] = useState(false)

  // ── Anotações state ───────────────────────────────────────────────────────
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [anotacaoModal, setAnotacaoModal] = useState(false)
  const [anotacaoForm, setAnotacaoForm] = useState({ texto: '', data: TODAY })
  const [anotacaoFotos, setAnotacaoFotos] = useState<string[]>([])
  const [anotacaoLoading, setAnotacaoLoading] = useState(false)

  const loadData = useCallback(async () => {
    const db = getDB()
    const t = await db.talhoes.get(id)
    if (!t) return
    setTalhao(t)
    // Refresh statuses so 'hoje'/'atrasado' are always accurate regardless of when app was saved
    try { await atualizarStatuses() } catch (e) { console.warn('[loadData] atualizarStatuses error', e) }
    const [faz, prods, apps] = await Promise.all([
      db.fazendas.get(t.fazenda_id),
      db.produtos.where('fazenda_id').equals(t.fazenda_id).toArray(),
      db.aplicacoes.where('talhao_id').equals(id).filter(a => !a.deleted_at).reverse().sortBy('data_aplicacao'),
    ])
    setFazenda(faz || null)
    setProdutos(prods)
    // Load recommendations for this fazenda
    if (t.fazenda_id) {
      const recs = await db.recomendacoes.where('fazenda_id').equals(t.fazenda_id).toArray()
      setRecomendacoes(recs)
    }
    const enriched = await Promise.all(apps.map(async a => {
      const prod = await db.produtos.get(a.produto_id)
      return { ...a, produto: prod }
    }))
    setAplicacoes(enriched as Aplicacao[])

    // Load semeadura etapas
    const ets = await db.semeaduraEtapas.where('talhao_id').equals(id).sortBy('etapa')
    setEtapas(ets)

    // Load pluviometria
    const pluvio = await db.pluviometros.where('talhao_id').equals(id).first()
    setPluviometro(pluvio || null)
    if (pluvio) {
      const registros = await db.registrosChuva
        .where('pluviometro_id').equals(pluvio.id)
        .reverse()
        .sortBy('data')
      setRegistrosChuva(registros.slice(0, 30))
    } else {
      setRegistrosChuva([])
    }

    // Load anotações
    const ants = await db.anotacoes
      .where('talhao_id').equals(id)
      .reverse()
      .sortBy('data')
    setAnotacoes(ants)

    // Load monitoramentos
    const mons = await db.monitoramentos
      .where('talhao_id').equals(id)
      .reverse()
      .sortBy('data')
    setMonitoramentos(mons)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // Re-load when server sync completes — restores data that pullFromServer wrote to Dexie
  const lastServerSyncAt = useAppStore(s => s.lastServerSyncAt)
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt, loadData])

  // ── Plantio ──────────────────────────────────────────────────────────────
  function openPlantioModal() {
    setPlantioForm({
      data_plantio: talhao?.data_plantio || TODAY,
      data_colheita_prevista: talhao?.data_colheita_prevista || '',
      status_semeadura: '',   // computed from etapas — not editable here
      area_semeada: '',       // computed from etapas — not editable here
    })
    setPlantioModal(true)
  }

  function handlePlantioDateChange(val: string) {
    setPlantioForm(f => {
      if (!val || !talhao) return { ...f, data_plantio: val }
      const ciclo = CICLO_CULTURA[talhao.cultura] ?? 120
      const colheita = format(addDays(parseISO(val), ciclo), 'yyyy-MM-dd')
      return { ...f, data_plantio: val, data_colheita_prevista: colheita }
    })
  }

  async function savePlantio() {
    if (!talhao || !user || !plantioForm.data_plantio) return
    setPlantioLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const updated: Talhao = {
        ...talhao,
        data_plantio: plantioForm.data_plantio,
        data_colheita_prevista: plantioForm.data_colheita_prevista || undefined,
        status_semeadura: plantioForm.status_semeadura as StatusSemeadura || undefined,
        area_semeada: plantioForm.area_semeada ? Number(plantioForm.area_semeada) : undefined,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await db.talhoes.put(updated)
      setTalhao(updated)
      // Sync talhão update to Supabase
      await enqueueSync('talhao', 'upsert', updated as unknown as Record<string, unknown>)
      processSyncQueue()

      const prods = await db.produtos.where('fazenda_id').equals(talhao.fazenda_id).toArray()
      await Promise.all([
        agendarAplicacoesPorPlantio(updated, prods, user.id),
        criarOuAtualizarSafra(updated),
        gerarNotificacoesSemeadura(updated, user.id),
      ])
      await loadData()
      setPlantioModal(false)
    } finally { setPlantioLoading(false) }
  }

  // ── Semeadura etapas ─────────────────────────────────────────────────────
  async function salvarEtapa() {
    if (!talhao || !user) return
    const area = Number(etapaForm.area_semeada)
    const totalJaSemeado = etapas.reduce((acc, e) => acc + e.area_semeada, 0)
    const areaRestante = Math.max(0, talhao.area - totalJaSemeado)

    if (!area || area <= 0) { setEtapaError('Informe a área semeada.'); return }
    if (area > areaRestante) {
      setEtapaError(`Área máxima disponível: ${areaRestante.toFixed(2)} ha (talhão: ${talhao.area} ha, já semeado: ${totalJaSemeado.toFixed(2)} ha).`)
      return
    }
    setEtapaError('')
    setEtapaLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const novaEtapa: SemeaduraEtapa = {
        id: gerarId(),
        talhao_id: id,
        fazenda_id: talhao.fazenda_id,
        usuario_id: user.id,
        etapa: etapas.length + 1,
        area_semeada: area,
        data_semeadura: etapaForm.data_semeadura || TODAY,
        observacoes: etapaForm.observacoes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await db.semeaduraEtapas.put(novaEtapa)
      await enqueueSync('semeadura_etapa', 'upsert', novaEtapa as unknown as Record<string, unknown>)

      // Recompute talhão cached totals so other pages see fresh data
      const novoTotal = totalJaSemeado + area
      const novoStatus: StatusSemeadura = novoTotal >= talhao.area ? 'finalizada' : 'em_andamento'
      const updatedTalhao: Talhao = {
        ...talhao,
        area_semeada: novoTotal,
        status_semeadura: novoStatus,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await db.talhoes.put(updatedTalhao)
      await enqueueSync('talhao', 'upsert', updatedTalhao as unknown as Record<string, unknown>)
      processSyncQueue()

      setEtapaModal(false)
      setEtapaForm({ area_semeada: '', data_semeadura: TODAY, observacoes: '' })
      await loadData()
    } finally { setEtapaLoading(false) }
  }

  // ── Aplicação ────────────────────────────────────────────────────────────
  function openAplicacaoModal(planejada?: Aplicacao, editing?: Aplicacao) {
    setAplicacaoBase(planejada || null)
    setEditingAplicacao(editing || null)
    setModalMode('produto')
    setSelectedRecomendacaoId('')
    const src = editing || planejada
    // Default tipo: 'realizada' when confirming a planned app; 'planejada' for new manual
    const tipoDefault = editing
      ? (editing.tipo === 'realizada' ? 'realizada' : 'planejada')
      : planejada ? 'realizada' : 'planejada'
    setForm({
      produto_id: src?.produto_id || '',
      data_aplicacao: src?.data_aplicacao || TODAY,
      dose: src?.dose?.toString() || '',
      unidade_dose: src?.unidade_dose || 'L/ha',
      area_aplicada: src?.area_aplicada?.toString() || '',
      observacoes: src?.observacoes || '',
      clima: src?.clima || '',
      temperatura: src?.temperatura?.toString() || '',
      tipo: tipoDefault,
    })
    // Guard: fotos must always be an array (Dexie may return undefined for old records)
    setFotos(Array.isArray(editing?.fotos) ? editing!.fotos : [])
    setModalOpen(true)
  }

  async function handleDeleteAplicacao(aplicacaoId: string) {
    const db = getDB()
    // Hard delete: remove from local Dexie + send delete action to Supabase
    await db.aplicacoes.delete(aplicacaoId)
    await enqueueSync('aplicacao', 'delete', { id: aplicacaoId })
    processSyncQueue()
    setAplicacoes(prev => prev.filter(a => a.id !== aplicacaoId))
    setDeletingApId(null)
  }

  async function handleSelectRecomendacao(recId: string) {
    setSelectedRecomendacaoId(recId)
    if (!recId) return
    // Pre-fill with the first RecomendacaoAplicacao for this talhão
    const db = getDB()
    const recApps = await db.recomendacaoAplicacoes
      .where('recomendacao_id').equals(recId)
      .and(r => r.talhao_id === id)
      .toArray()
    const first = recApps[0]
    if (first) {
      setForm(f => ({
        ...f,
        produto_id: first.produto_id || f.produto_id,
        data_aplicacao: first.data_aplicacao || f.data_aplicacao,
        dose: first.dose?.toString() || f.dose,
        unidade_dose: first.unidade_dose || f.unidade_dose,
        observacoes: first.observacoes || f.observacoes,
      }))
    }
  }

  async function handleSaveAplicacao() {
    if (!user || !form.produto_id || !form.data_aplicacao) return
    const prod = produtos.find(p => p.id === form.produto_id)
    if (!prod) return

    // Validate area_aplicada does not exceed talhão area
    const areaAplicada = form.area_aplicada ? Number(form.area_aplicada) : talhao?.area
    if (talhao && areaAplicada && areaAplicada > talhao.area) {
      alert(`Área aplicada (${areaAplicada} ha) não pode ser maior que o talhão (${talhao.area} ha).`)
      return
    }

    setLoading(true)
    try {
      const db = getDB()

      // If editing an existing application (realizada or planejada)
      if (editingAplicacao) {
        const now = new Date().toISOString()
        // Status: planejadas use data_aplicacao; realizadas are always done
        const novoStatus = form.tipo === 'realizada'
          ? ('dentro_do_prazo' as const)
          : calcularStatusLocal(form.data_aplicacao)
        const updated: Aplicacao = {
          ...editingAplicacao,
          tipo: form.tipo,
          produto_id: form.produto_id,
          data_aplicacao: form.data_aplicacao,
          // proxima_aplicacao não é recalculada automaticamente: prazo_medio_aplicacao é apenas informativo
          proxima_aplicacao: editingAplicacao.proxima_aplicacao,
          status: novoStatus,
          dose: form.dose ? Number(form.dose) : undefined,
          unidade_dose: form.unidade_dose,
          area_aplicada: form.area_aplicada ? Number(form.area_aplicada) : talhao?.area,
          observacoes: form.observacoes,
          clima: form.clima,
          temperatura: form.temperatura ? Number(form.temperatura) : undefined,
          fotos: fotos.length > 0 ? fotos : editingAplicacao.fotos,
          updatedAt: now,
          _syncStatus: 'pending',
        }
        await db.aplicacoes.put(updated)
        await enqueueSync('aplicacao', 'upsert', updated as unknown as Record<string, unknown>)
        processSyncQueue()
        await loadData()
        setModalOpen(false)
        setEditingAplicacao(null)
        setForm({ produto_id: '', data_aplicacao: TODAY, dose: '', unidade_dose: 'L/ha', area_aplicada: '', observacoes: '', clima: '', temperatura: '', tipo: 'planejada' })
        setFotos([])
        return
      }

      // If confirming a planned app: delete the old planned record
      if (aplicacaoBase?.id && aplicacaoBase.tipo === 'planejada') {
        await db.aplicacoes.delete(aplicacaoBase.id)
      }
      await criarAplicacao({
        talhao_id: id,
        produto_id: form.produto_id,
        tipo: form.tipo,
        data_aplicacao: form.data_aplicacao,
        prazo_produto: prod.prazo_medio_aplicacao,
        dose: form.dose ? Number(form.dose) : undefined,
        unidade_dose: form.unidade_dose,
        area_aplicada: areaAplicada,
        observacoes: form.observacoes,
        clima: form.clima,
        temperatura: form.temperatura ? Number(form.temperatura) : undefined,
        fotos: fotos.length > 0 ? fotos : undefined,
        usuario_id: user.id,
      })
      // Subtrair estoque apenas ao registrar realizada
      if (form.tipo === 'realizada' && prod.quantidade_disponivel != null && form.dose && areaAplicada) {
        const quantidadeUsada = Number(form.dose) * areaAplicada
        const novaQuantidade = Math.max(0, prod.quantidade_disponivel - quantidadeUsada)
        const now = new Date().toISOString()
        const updatedProd = { ...prod, quantidade_disponivel: novaQuantidade, updatedAt: now }
        await db.produtos.update(form.produto_id, { quantidade_disponivel: novaQuantidade, updatedAt: now })
        await enqueueSync('produto', 'upsert', updatedProd as unknown as Record<string, unknown>)
        processSyncQueue()
      }
      await loadData()
      setModalOpen(false)
      setAplicacaoBase(null)
      setFotos([])
      setModalMode('produto')
      setSelectedRecomendacaoId('')
      setForm({
        produto_id: '', data_aplicacao: TODAY,
        dose: '', unidade_dose: 'L/ha', area_aplicada: '', observacoes: '', clima: '', temperatura: '', tipo: 'planejada' as const,
      })
    } finally { setLoading(false) }
  }

  // ── Pluviometria ─────────────────────────────────────────────────────────
  async function salvarPluviometro() {
    if (!talhao || !user || !pluvioNome.trim()) return
    setPluvioLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const novo: Pluviometro = {
        id: gerarId(),
        nome: pluvioNome.trim(),
        fazenda_id: talhao.fazenda_id,
        talhao_id: id,
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await db.pluviometros.put(novo)
      setPluviometro(novo)
      setConfigurandoPluviometro(false)
      setPluvioNome('')
    } finally { setPluvioLoading(false) }
  }

  async function salvarRegistroChuva() {
    if (!pluviometro || !talhao || !chuvaForm.data || !chuvaForm.volume_mm) return
    setChuvaLoading(true)
    try {
      const db = getDB()
      const novo: RegistroChuva = {
        id: gerarId(),
        pluviometro_id: pluviometro.id,
        fazenda_id: talhao.fazenda_id,
        data: chuvaForm.data,
        volume_mm: Number(chuvaForm.volume_mm),
        createdAt: new Date().toISOString(),
      }
      await db.registrosChuva.put(novo)
      setChuvaForm({ data: TODAY, volume_mm: '' })
      setShowChuvaForm(false)
      await loadData()
    } finally { setChuvaLoading(false) }
  }

  // Derived rain totals
  const hoje7 = subDays(new Date(), 7)
  const hoje30 = subDays(new Date(), 30)
  const total7dias = registrosChuva
    .filter(r => parseISO(r.data) >= hoje7)
    .reduce((acc, r) => acc + r.volume_mm, 0)
  const total30dias = registrosChuva
    .filter(r => parseISO(r.data) >= hoje30)
    .reduce((acc, r) => acc + r.volume_mm, 0)

  // ── Anotações ────────────────────────────────────────────────────────────
  function openAnotacaoModal() {
    setAnotacaoForm({ texto: '', data: TODAY })
    setAnotacaoFotos([])
    setAnotacaoModal(true)
  }

  async function salvarAnotacao() {
    if (!talhao || !user || !anotacaoForm.texto.trim()) return
    setAnotacaoLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const nova: Anotacao = {
        id: gerarId(),
        talhao_id: id,
        fazenda_id: talhao.fazenda_id,
        usuario_id: user.id,
        texto: anotacaoForm.texto.trim(),
        fotos: anotacaoFotos.length > 0 ? anotacaoFotos : undefined,
        data: anotacaoForm.data || TODAY,
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await db.anotacoes.put(nova)
      setAnotacaoModal(false)
      await loadData()
    } finally { setAnotacaoLoading(false) }
  }

  // ── Marcar aplicação como realizada — requer data de quando ocorreu ────────
  async function handleConfirmarRealizada(aplicacaoId: string, dataRealizada: string) {
    if (!dataRealizada || !user) return
    const db = getDB()
    const now = new Date().toISOString()
    const aplicacao = await db.aplicacoes.get(aplicacaoId)
    await db.aplicacoes.update(aplicacaoId, {
      tipo: 'realizada',
      data_aplicacao: dataRealizada,
      status: 'dentro_do_prazo',
      updatedAt: now,
      _syncStatus: 'pending',
    })
    const updated = await db.aplicacoes.get(aplicacaoId)
    if (updated) {
      await enqueueSync('aplicacao', 'upsert', updated as unknown as Record<string, unknown>)
    }
    // Subtrair estoque ao confirmar realizada
    if (aplicacao && talhao) {
      const prod = await db.produtos.get(aplicacao.produto_id)
      if (prod && prod.quantidade_disponivel != null && aplicacao.dose && aplicacao.area_aplicada) {
        const quantidadeUsada = aplicacao.dose * aplicacao.area_aplicada
        const qtdAnterior = prod.quantidade_disponivel
        const qtdNova = Math.max(0, qtdAnterior - quantidadeUsada)
        await db.produtos.update(prod.id, { quantidade_disponivel: qtdNova, updatedAt: now })
        const updatedProd = { ...prod, quantidade_disponivel: qtdNova, updatedAt: now }
        await enqueueSync('produto', 'upsert', updatedProd as unknown as Record<string, unknown>)
        const mov = {
          id: gerarId(),
          produto_id: prod.id,
          fazenda_id: talhao.fazenda_id,
          usuario_id: user.id,
          tipo: 'saida' as const,
          quantidade: quantidadeUsada,
          quantidade_anterior: qtdAnterior,
          quantidade_nova: qtdNova,
          motivo: `Aplicação realizada em ${dataRealizada}`,
          data: dataRealizada,
          createdAt: now,
        }
        await db.estoqueMovimentacoes.add(mov)
        await enqueueSync('estoqueMovimentacao', 'upsert', mov as unknown as Record<string, unknown>)
      }
    }
    processSyncQueue()
    setMarcarRealizadaId(null)
    setMarcarRealizadaDate(TODAY)
    await loadData()
  }

  // ── Derived semeadura data ────────────────────────────────────────────────
  // Prefer sum of loaded etapas; fall back to talhão record when etapas are
  // missing locally (e.g. after browser cache clear, before server sync restores them)
  const totalSemeadoEtapas = etapas.reduce((acc, e) => acc + e.area_semeada, 0)
  const totalSemeado   = etapas.length > 0 ? totalSemeadoEtapas : (talhao?.area_semeada ?? 0)
  const etapasMissing  = etapas.length === 0 && totalSemeado > 0   // etapas perdidas localmente
  const areaRestante   = talhao ? Math.max(0, talhao.area - totalSemeadoEtapas) : 0
  const semeaduraPctEt = talhao && talhao.area > 0 ? Math.min(100, (totalSemeado / talhao.area) * 100) : 0
  const statusSemeaduraComputado: StatusSemeadura =
    totalSemeado <= 0 ? 'nao_iniciada' :
    talhao && totalSemeado >= talhao.area ? 'finalizada' : 'em_andamento'
  // Allow re-registration when etapas are missing locally (etapasMissing), even if cached status = finalizada
  const podeSemearMais = talhao?.data_plantio && (statusSemeaduraComputado !== 'finalizada' || etapasMissing)

  // ── Derived data ─────────────────────────────────────────────────────────
  const planejadas = aplicacoes.filter(a => a.tipo === 'planejada')
  const realizadas = aplicacoes.filter(a => a.tipo !== 'planejada')
  // Contagem de alertas — apenas não-realizadas
  const hoje_apls  = planejadas.filter(a => a.status === 'hoje')
  const atrasadas  = planejadas.filter(a => a.status === 'atrasado')
  const proximas   = planejadas.filter(a => a.status === 'proximo')

  const hojeDate = new Date(); hojeDate.setHours(0, 0, 0, 0)
  let cicloProgress = -1
  let cicloTotal = 0
  let diasDecorridos = 0
  let diasRestantes = 0

  if (talhao?.data_plantio) {
    const plantio = parseISO(talhao.data_plantio)
    cicloTotal = CICLO_CULTURA[talhao.cultura] ?? 120
    diasDecorridos = differenceInDays(hojeDate, plantio)
    diasRestantes = cicloTotal - diasDecorridos
    cicloProgress = Math.min(100, Math.max(0, (diasDecorridos / cicloTotal) * 100))
  }

  const phase = getCropPhase(cicloProgress)

  if (!talhao) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--fg-subtle)' }}>
      Talhão não encontrado
    </div>
  )

  const semeaduraColors = STATUS_SEMEADURA_COLORS[statusSemeaduraComputado]

  // ── Monitoramento CRUD ────────────────────────────────────────────────────
  async function saveMonitoramento(data: Omit<MonitoramentoPraga, 'id' | 'createdAt' | 'updatedAt' | '_syncStatus'>) {
    if (!user) return
    const db = getDB()
    const now = new Date().toISOString()
    const record: MonitoramentoPraga = editingMonitoramento
      ? { ...editingMonitoramento, ...data, updatedAt: now, _syncStatus: 'pending' }
      : { id: gerarId(), ...data, createdAt: now, updatedAt: now, _syncStatus: 'pending' }
    await db.monitoramentos.put(record)
    await enqueueSync('monitoramento', 'upsert', record as unknown as Record<string, unknown>)
    processSyncQueue()
    setEditingMonitoramento(null)
    await loadData()
  }

  async function deleteMonitoramento(monId: string) {
    if (!confirm('Excluir este registro de monitoramento?')) return
    const db = getDB()
    await db.monitoramentos.delete(monId)
    await enqueueSync('monitoramento', 'delete', { id: monId })
    processSyncQueue()
    await loadData()
  }

  const worstSev = worstSeveridade(monitoramentos.map(m => m.severidade))

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="animate-enter animate-enter-1 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/fazendas/${talhao.fazenda_id}`}
            className="p-2 rounded-xl transition flex-shrink-0"
            style={{ border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{culturaIcon(talhao.cultura)}</span>
              <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>
                {talhao.nome}
              </h1>
              {monitoramentos.length > 0 && <SeveridadeDot severidade={worstSev} />}
            </div>
            <p className="text-sm ml-8" style={{ color: 'var(--fg-muted)' }}>
              {fazenda?.nome} · {culturaLabel(talhao.cultura)} · {talhao.area} ha
            </p>
          </div>
        </div>
        {produtos.length > 0 && (
          <Button onClick={() => openAplicacaoModal()} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar
          </Button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="animate-enter animate-enter-2 flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: 'var(--bg-dark)' }}>
        {([
          { key: 'info',         label: 'Visão Geral', icon: <Sprout size={14} /> },
          { key: 'monitoramento', label: 'Monitoramento', icon: <Bug size={14} />, count: monitoramentos.length },
        ] as { key: TalhaoTab; label: string; icon: React.ReactNode; count?: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: activeTab === t.key ? 'var(--bg-card)' : 'transparent',
              color:      activeTab === t.key ? 'var(--fg)' : 'var(--fg-muted)',
              boxShadow:  activeTab === t.key ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: activeTab === t.key ? 'hsl(160 84% 22% / 0.12)' : 'transparent', color: activeTab === t.key ? 'hsl(160 84% 22%)' : 'inherit' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════ MONITORAMENTO TAB ══════════════════ */}
      {activeTab === 'monitoramento' && (
        <div className="animate-enter animate-enter-3">
          {/* Tendência alert */}
          {monitoramentos.length > 0 && (
            <div className="mb-4">
              <TendenciaAlerta registros={monitoramentos} cultura={talhao.cultura as CulturaType} />
            </div>
          )}
          {/* Actions */}
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Registros de Monitoramento</p>
            <Button
              size="sm"
              onClick={() => { setEditingMonitoramento(null); setMonitoramentoModal(true) }}
              className="gap-1"
            >
              <Plus className="w-4 h-4" /> Novo Registro
            </Button>
          </div>
          {monitoramentos.length === 0 ? (
            <div className="card p-10 text-center">
              <Bug className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--fg-subtle)', opacity: 0.4 }} />
              <p className="text-sm mb-3" style={{ color: 'var(--fg-muted)' }}>Nenhum monitoramento registrado</p>
              <button
                onClick={() => { setEditingMonitoramento(null); setMonitoramentoModal(true) }}
                className="text-xs font-semibold"
                style={{ color: 'hsl(160 84% 22%)' }}
              >
                + Registrar primeiro monitoramento
              </button>
            </div>
          ) : (
            <MonitoramentoTimeline
              registros={monitoramentos}
              cultura={talhao.cultura as CulturaType}
              onEdit={(r) => { setEditingMonitoramento(r); setMonitoramentoModal(true) }}
              onDelete={deleteMonitoramento}
            />
          )}
          <MonitoramentoModal
            open={monitoramentoModal}
            onClose={() => { setMonitoramentoModal(false); setEditingMonitoramento(null) }}
            onSave={saveMonitoramento}
            editRecord={editingMonitoramento}
            talhaoId={talhao.id}
            fazendaId={talhao.fazenda_id}
            usuarioId={user?.id ?? ''}
            cultura={talhao.cultura as CulturaType}
          />
        </div>
      )}

      {/* ══════════════════════════════ INFO TAB ═══════════════════════════ */}
      {activeTab === 'info' && <>

      {/* ── Plantio Card ── */}
      <div className="animate-enter animate-enter-2 card p-5 mb-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(130 55% 30% / 0.12)' }}>
              <Sprout size={16} style={{ color: 'hsl(130 55% 30%)' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
                {talhao.data_plantio ? 'Ciclo de Cultivo' : 'Plantio não iniciado'}
              </h3>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {talhao.data_plantio
                  ? `Plantio: ${format(parseISO(talhao.data_plantio), "dd 'de' MMM yyyy", { locale: ptBR })}`
                  : 'Defina a data de plantio para ativar o acompanhamento'}
              </p>
            </div>
          </div>
          <button
            onClick={openPlantioModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={{
              background: talhao.data_plantio ? 'var(--bg-dark)' : 'hsl(130 55% 30%)',
              color: talhao.data_plantio ? 'var(--fg-muted)' : 'white',
            }}
          >
            {talhao.data_plantio ? <><Pencil size={11} /> Editar</> : <><Calendar size={11} /> Definir Plantio</>}
          </button>
        </div>

        {talhao.data_plantio && (
          <>
            {/* Cycle progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: phase.color }}>{phase.label}</span>
                <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                  {cicloProgress.toFixed(0)}% do ciclo
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${cicloProgress}%`,
                    background: `linear-gradient(90deg, hsl(130 55% 30%), ${phase.color})`,
                  }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--fg)' }}>
                  {Math.max(0, diasDecorridos)}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>dias plantados</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                <div className="text-lg font-bold" style={{ color: 'var(--fg)' }}>
                  {cicloTotal}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>dias no ciclo</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                <div className="text-lg font-bold" style={{ color: diasRestantes <= 14 ? 'hsl(32 95% 40%)' : 'var(--fg)' }}>
                  {Math.max(0, diasRestantes)}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>dias p/ colheita</div>
              </div>
            </div>

            {/* Semeadura summary strip — always shown when plantio is set */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--borda)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Semeadura</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ color: semeaduraColors.color, background: semeaduraColors.bg }}
                  >
                    {STATUS_SEMEADURA_LABELS[statusSemeaduraComputado]}
                  </span>
                  {etapas.length > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
                      {etapas.length} etapa{etapas.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                  {totalSemeado.toFixed(1)} / {talhao.area} ha ({semeaduraPctEt.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${semeaduraPctEt}%`, background: semeaduraColors.color }}
                />
              </div>
            </div>

            {talhao.data_colheita_prevista && (
              <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: 'var(--fg-subtle)' }}>
                <CheckCircle2 size={11} style={{ color: 'hsl(32 95% 40%)' }} />
                Colheita prevista: {format(parseISO(talhao.data_colheita_prevista), "dd 'de' MMM yyyy", { locale: ptBR })}
              </p>
            )}
          </>
        )}

        {!talhao.data_plantio && (
          <div className="mt-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 80% 38%)' }}>
            Com o plantio definido, as aplicações de produtos serão agendadas automaticamente com base no ciclo da cultura e nos produtos cadastrados na fazenda.
          </div>
        )}
      </div>

      {/* ── Semeadura Etapas Card ── */}
      {talhao.data_plantio && (
        <div className="animate-enter animate-enter-2 card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(210 100% 45% / 0.1)' }}>
                <Layers size={16} style={{ color: 'hsl(210 100% 40%)' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Etapas de Semeadura</h3>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                  {statusSemeaduraComputado === 'finalizada'
                    ? `${talhao.area} ha semeados — concluído`
                    : statusSemeaduraComputado === 'em_andamento'
                    ? `${totalSemeado.toFixed(1)} ha de ${talhao.area} ha · ${areaRestante.toFixed(1)} ha restantes`
                    : `${talhao.area} ha a semear`}
                </p>
              </div>
            </div>
            {podeSemearMais && (
              <button
                onClick={() => { setEtapaError(''); setEtapaForm({ area_semeada: '', data_semeadura: TODAY, observacoes: '' }); setEtapaModal(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                style={{ background: 'hsl(210 100% 45%)', color: 'white' }}
              >
                <Plus size={11} /> Registrar
              </button>
            )}
          </div>

          {/* Stage list */}
          {etapas.length === 0 ? (
            <div className="rounded-xl py-5 text-center" style={{ background: 'var(--bg)' }}>
              {etapasMissing ? (
                <>
                  <p className="text-sm font-medium" style={{ color: 'hsl(32 95% 38%)' }}>
                    Etapas não encontradas localmente
                  </p>
                  <p className="text-xs mt-1 mb-3" style={{ color: 'var(--fg-muted)' }}>
                    O registro de {totalSemeado.toFixed(1)} ha semeados está salvo, mas os detalhes das etapas foram perdidos do cache local (possível limpeza do browser ou troca de dispositivo). Re-registre as etapas abaixo para restaurar o histórico.
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  Nenhuma etapa registrada ainda.
                </p>
              )}
              <button
                onClick={() => { setEtapaError(''); setEtapaForm({ area_semeada: '', data_semeadura: TODAY, observacoes: '' }); setEtapaModal(true) }}
                className="mt-1 text-xs font-semibold"
                style={{ color: 'hsl(210 100% 40%)' }}
              >
                + Registrar {etapasMissing ? 'nova' : '1ª'} etapa
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {etapas.map((et, i) => {
                const pctEtapa = talhao.area > 0 ? (et.area_semeada / talhao.area) * 100 : 0
                return (
                  <div
                    key={et.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl"
                    style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                      style={{ background: 'hsl(210 100% 45% / 0.12)', color: 'hsl(210 100% 35%)' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                          {etapaOrdinal(et.etapa)} — {et.area_semeada} ha ({pctEtapa.toFixed(0)}%)
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                          {(() => { const [y,m,d] = et.data_semeadura.split('-').map(Number); return format(new Date(y,m-1,d), 'dd/MM/yyyy') })()}
                        </span>
                      </div>
                      {et.observacoes && (
                        <p className="text-[11px] truncate" style={{ color: 'var(--fg-muted)' }}>{et.observacoes}</p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Total bar */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--fg-muted)' }}>Total semeado</span>
                  <span className="text-[11px] font-semibold" style={{ color: semeaduraColors.color }}>
                    {totalSemeado.toFixed(1)} / {talhao.area} ha
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${semeaduraPctEt}%`, background: semeaduraColors.color }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert cards */}
      {(hoje_apls.length > 0 || atrasadas.length > 0 || proximas.length > 0) && (
        <div className="animate-enter animate-enter-2 grid gap-3 mb-5"
          style={{ gridTemplateColumns: `repeat(${[hoje_apls.length > 0, atrasadas.length > 0, proximas.length > 0].filter(Boolean).length}, 1fr)` }}>
          {hoje_apls.length > 0 && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'hsl(210 100% 96%)', border: '1px solid hsl(210 100% 88%)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(210 100% 90%)' }}>
                <CheckCircle2 className="w-5 h-5" style={{ color: 'hsl(210 100% 45%)' }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: 'hsl(210 100% 38%)' }}>{hoje_apls.length}</div>
                <div className="text-xs" style={{ color: 'hsl(210 100% 50%)' }}>hoje</div>
              </div>
            </div>
          )}
          {atrasadas.length > 0 && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'hsl(0 86% 97%)', border: '1px solid hsl(0 86% 90%)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(0 86% 93%)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'hsl(0 72% 51%)' }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: 'hsl(0 72% 40%)' }}>{atrasadas.length}</div>
                <div className="text-xs" style={{ color: 'hsl(0 72% 55%)' }}>atrasada{atrasadas.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
          {proximas.length > 0 && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'hsl(45 100% 96%)', border: '1px solid hsl(45 100% 88%)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(45 100% 90%)' }}>
                <Calendar className="w-5 h-5" style={{ color: 'hsl(32 95% 44%)' }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: 'hsl(32 95% 35%)' }}>{proximas.length}</div>
                <div className="text-xs" style={{ color: 'hsl(32 95% 50%)' }}>próxima{proximas.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No products warning */}
      {produtos.length === 0 && (
        <div className="animate-enter animate-enter-2 flex items-start gap-3 p-4 rounded-2xl mb-5"
          style={{ background: 'hsl(45 100% 96%)', border: '1px solid hsl(45 100% 88%)' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(32 95% 44%)' }} />
          <div>
            <p className="font-medium text-sm" style={{ color: 'hsl(32 95% 30%)' }}>Nenhum produto cadastrado</p>
            <p className="text-sm mt-0.5" style={{ color: 'hsl(32 95% 45%)' }}>
              Cadastre produtos na fazenda para habilitar o agendamento automático.{' '}
              <Link href={`/fazendas/${talhao.fazenda_id}`} className="underline font-medium">
                Ir para Produtos →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Aplicações Planejadas ── */}
      {planejadas.length > 0 && (
        <div className="animate-enter animate-enter-3 mb-6">
          <button
            className="flex items-center justify-between w-full mb-3"
            onClick={() => setShowPlanned(v => !v)}
          >
            <div className="flex items-center gap-2">
              <p className="section-label" style={{ margin: 0 }}>Agendamento Automático</p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(210 100% 96%)', color: 'hsl(210 100% 40%)' }}>
                {planejadas.length} aplicaç{planejadas.length !== 1 ? 'ões' : 'ão'}
              </span>
            </div>
            {showPlanned ? <ChevronUp size={14} style={{ color: 'var(--fg-subtle)' }} /> : <ChevronDown size={14} style={{ color: 'var(--fg-subtle)' }} />}
          </button>

          {showPlanned && (
            <div className="space-y-2">
              {planejadas.map((a, i) => {
                const prod = a.produto
                const statusColors: Record<string, { color: string; bg: string }> = {
                  atrasado:        { color: 'hsl(4 72% 45%)',    bg: 'hsl(4 80% 97%)' },
                  hoje:            { color: 'hsl(210 100% 40%)', bg: 'hsl(210 100% 96%)' },
                  proximo:         { color: 'hsl(32 95% 40%)',   bg: 'hsl(45 100% 93%)' },
                  dentro_do_prazo: { color: 'hsl(160 84% 22%)',  bg: 'hsl(160 84% 22% / 0.08)' },
                }
                const sc = statusColors[a.status] || statusColors.dentro_do_prazo
                return (
                  <div key={a.id} className="animate-enter card p-4 flex items-center gap-3"
                    style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: sc.bg }}>
                      <Clock3 size={15} style={{ color: sc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: 'var(--fg)' }}>
                        {(prod as any)?.nome || 'Produto'}
                      </div>
                      <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--fg-muted)' }}>
                        <span>{(() => { const [y,m,d] = a.data_aplicacao.split('-').map(Number); return format(new Date(y,m-1,d), 'dd/MM/yyyy') })()}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ color: sc.color, background: sc.bg }}>
                          {a.status === 'atrasado' ? 'Atrasada' : a.status === 'hoje' ? 'Hoje' : a.status === 'proximo' ? 'Próxima' : 'Agendada'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {deletingApId === a.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteAplicacao(a.id)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: 'hsl(4 72% 50%)', color: 'white' }}
                          >
                            Excluir
                          </button>
                          <button
                            onClick={() => setDeletingApId(null)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: 'var(--bg-dark)', color: 'var(--fg-muted)' }}
                          >
                            ✕
                          </button>
                        </>
                      ) : marcarRealizadaId === a.id ? (
                        /* ── Inline: confirmar data de realização ── */
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={marcarRealizadaDate}
                            onChange={e => setMarcarRealizadaDate(e.target.value)}
                            className="text-[11px] px-2 py-1 rounded-lg border"
                            style={{ borderColor: 'var(--borda)', background: 'var(--bg)', color: 'var(--fg)', outline: 'none' }}
                          />
                          <button
                            onClick={() => handleConfirmarRealizada(a.id, marcarRealizadaDate)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: 'hsl(160 84% 22%)', color: 'white' }}
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setMarcarRealizadaId(null)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg"
                            style={{ background: 'var(--bg-dark)', color: 'var(--fg-muted)' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setDeletingApId(a.id)}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--fg-subtle)' }}
                            title="Remover"
                            onMouseEnter={e => { e.currentTarget.style.background = 'hsl(4 86% 96%)'; e.currentTarget.style.color = 'hsl(4 72% 45%)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => openAplicacaoModal(undefined, a)}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--fg-subtle)' }}
                            title="Editar agendamento"
                            onMouseEnter={e => { e.currentTarget.style.background = 'hsl(210 100% 96%)'; e.currentTarget.style.color = 'hsl(210 100% 40%)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setMarcarRealizadaId(a.id); setMarcarRealizadaDate(TODAY) }}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
                            style={{ borderColor: 'hsl(160 84% 22% / 0.4)', color: 'hsl(160 84% 22%)', background: 'hsl(160 84% 22% / 0.06)' }}
                            title="Marcar como realizada"
                          >
                            <CheckCircle2 size={12} /> Feita
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Histórico ── */}
      <div className="animate-enter animate-enter-4 mb-8">
        <button
          className="flex items-center justify-between w-full mb-3"
          onClick={() => setShowHistory(v => !v)}
        >
          <div className="flex items-center gap-2">
            <p className="section-label" style={{ margin: 0 }}>Aplicações</p>
            {realizadas.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(160 84% 22% / 0.1)', color: 'hsl(160 84% 22%)' }}>
                {realizadas.length}
              </span>
            )}
          </div>
          {showHistory ? <ChevronUp size={14} style={{ color: 'var(--fg-subtle)' }} /> : <ChevronDown size={14} style={{ color: 'var(--fg-subtle)' }} />}
        </button>

        {showHistory && (
          realizadas.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--bg-dark)' }}>
                <FlaskConical className="w-7 h-7" style={{ color: 'var(--fg-subtle)' }} />
              </div>
              <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhuma aplicação registrada</p>
              {produtos.length > 0 && (
                <button onClick={() => openAplicacaoModal()} className="mt-2 text-sm font-medium"
                  style={{ color: 'var(--primary)' }}>
                  Registrar primeira aplicação →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {realizadas.map((a, i) => {
                const prod = a.produto as any
                const areaApl = a.area_aplicada ?? talhao.area
                const qtdUsada = (a.dose && areaApl) ? Number((a.dose * areaApl).toFixed(2)) : null
                const unidade = a.unidade_dose?.split('/')[0] ?? ''
                const [ay, am, ad] = a.data_aplicacao.split('-').map(Number)
                const isRealizada = a.tipo === 'realizada'
                const borderColor = isRealizada
                  ? 'hsl(160 84% 22%)'
                  : a.status === 'atrasado' ? 'hsl(4 72% 50%)'
                  : a.status === 'hoje' ? 'hsl(210 100% 45%)'
                  : a.status === 'proximo' ? 'hsl(38 70% 40%)'
                  : 'hsl(160 70% 42%)'
                const iconColor = isRealizada
                  ? 'hsl(160 84% 22%)'
                  : a.status === 'atrasado' ? 'hsl(4 72% 45%)'
                  : a.status === 'hoje' ? 'hsl(210 100% 40%)'
                  : a.status === 'proximo' ? 'hsl(32 95% 40%)'
                  : 'hsl(160 84% 22%)'
                const iconBg = isRealizada
                  ? 'hsl(160 84% 22% / 0.1)'
                  : a.status === 'atrasado' ? 'hsl(4 86% 96%)'
                  : a.status === 'hoje' ? 'hsl(210 100% 96%)'
                  : a.status === 'proximo' ? 'hsl(45 100% 93%)'
                  : 'hsl(160 84% 22% / 0.08)'
                const badgeText = isRealizada
                  ? '✓ Realizada'
                  : a.status === 'atrasado' ? 'Atrasada'
                  : a.status === 'hoje' ? 'Hoje'
                  : 'Agendada'
                return (
                  <div key={a.id} className="animate-enter card overflow-hidden"
                    style={{ animationDelay: `${(i + 3) * 50}ms`, borderLeft: `3px solid ${borderColor}` }}>
                    <div className="px-4 py-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: iconBg }}>
                            {isRealizada
                              ? <CheckCircle2 size={13} style={{ color: iconColor }} />
                              : <Clock3 size={13} style={{ color: iconColor }} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg)' }}>
                              {prod?.nome || 'Produto'}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                              {format(new Date(ay, am - 1, ad), "dd 'de' MMM yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: iconBg, color: iconColor }}>
                            {badgeText}
                          </span>
                          {deletingApId === a.id ? (
                            <>
                              <button
                                onClick={() => handleDeleteAplicacao(a.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: 'hsl(4 72% 50%)', color: 'white' }}
                              >
                                Excluir
                              </button>
                              <button
                                onClick={() => setDeletingApId(null)}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
                                style={{ background: 'var(--bg-dark)', color: 'var(--fg-muted)' }}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => openAplicacaoModal(undefined, a)}
                                className="p-1 rounded-lg transition"
                                style={{ color: 'var(--fg-subtle)' }}
                                title="Editar aplicação"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setDeletingApId(a.id)}
                                className="p-1 rounded-lg transition-all"
                                style={{ color: 'var(--fg-subtle)' }}
                                title="Remover aplicação"
                                onMouseEnter={e => { e.currentTarget.style.background = 'hsl(4 86% 96%)'; e.currentTarget.style.color = 'hsl(4 72% 45%)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Detail pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {a.dose != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}>
                            Dose: {a.dose} {a.unidade_dose}
                          </span>
                        )}
                        {areaApl != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}>
                            Área: {areaApl} ha
                          </span>
                        )}
                        {qtdUsada != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'hsl(210 100% 97%)', border: '1px solid hsl(210 100% 88%)', color: 'hsl(210 80% 38%)' }}>
                            Usado: {qtdUsada} {unidade}
                          </span>
                        )}
                        {prod?.quantidade_disponivel != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: prod.quantidade_disponivel < 10 ? 'hsl(4 86% 96%)' : 'var(--bg)',
                              border: `1px solid ${prod.quantidade_disponivel < 10 ? 'hsl(4 72% 88%)' : 'var(--borda)'}`,
                              color: prod.quantidade_disponivel < 10 ? 'hsl(4 72% 45%)' : 'var(--fg-muted)',
                            }}>
                            Estoque: {prod.quantidade_disponivel} {prod.unidade_quantidade || unidade}
                          </span>
                        )}
                        {a.clima && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-muted)' }}>
                            🌤 {a.clima}
                          </span>
                        )}
                      </div>

                      {a.observacoes && (
                        <p className="mt-2 text-xs line-clamp-1 px-2.5 py-1.5 rounded-lg"
                          style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-subtle)' }}>
                          {a.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* ── Pluviometria ── */}
      <div className="animate-enter animate-enter-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CloudRain size={15} style={{ color: 'hsl(210 80% 45%)' }} />
            <p className="section-label" style={{ margin: 0 }}>Pluviometria</p>
          </div>
          {pluviometro && !showChuvaForm && (
            <Button
              size="sm"
              onClick={() => setShowChuvaForm(true)}
              style={{ fontSize: '12px', padding: '0.35rem 0.85rem' }}
            >
              <Plus size={12} /> Registrar Chuva
            </Button>
          )}
        </div>

        {!pluviometro ? (
          /* No pluviometer yet */
          configurandoPluviometro ? (
            <div className="card p-5 space-y-4">
              <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Configurar Pluviômetro</p>
              <Input
                label="Nome do pluviômetro"
                value={pluvioNome}
                onChange={e => setPluvioNome(e.target.value)}
                placeholder={talhao.nome}
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setConfigurandoPluviometro(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={salvarPluviometro}
                  loading={pluvioLoading}
                  disabled={!pluvioNome.trim()}
                  className="flex-1"
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'hsl(210 80% 45% / 0.1)' }}>
                <Droplets className="w-6 h-6" style={{ color: 'hsl(210 80% 45%)' }} />
              </div>
              <p className="font-semibold mb-1 text-sm" style={{ color: 'var(--fg)' }}>Nenhum pluviômetro configurado</p>
              <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
                Configure um pluviômetro para registrar chuvas neste talhão.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setPluvioNome(talhao.nome)
                  setConfigurandoPluviometro(true)
                }}
              >
                Configurar Pluviômetro
              </Button>
            </div>
          )
        ) : (
          /* Pluviometer exists */
          <div className="space-y-4">
            {/* Totals summary */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Droplets size={14} style={{ color: 'hsl(210 80% 45%)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>
                  {pluviometro.nome}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                  <div className="text-lg font-bold" style={{ color: 'hsl(210 80% 40%)' }}>
                    {total7dias.toFixed(1)} mm
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>últimos 7 dias</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                  <div className="text-lg font-bold" style={{ color: 'hsl(210 80% 40%)' }}>
                    {total30dias.toFixed(1)} mm
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>últimos 30 dias</div>
                </div>
              </div>
            </div>

            {/* Inline add form */}
            {showChuvaForm && (
              <div className="card p-4 space-y-3">
                <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Registrar Chuva</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Data"
                    type="date"
                    value={chuvaForm.data}
                    onChange={e => setChuvaForm(f => ({ ...f, data: e.target.value }))}
                  />
                  <Input
                    label="Volume (mm)"
                    type="number"
                    value={chuvaForm.volume_mm}
                    onChange={e => setChuvaForm(f => ({ ...f, volume_mm: e.target.value }))}
                    placeholder="Ex: 12.5"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowChuvaForm(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={salvarRegistroChuva}
                    loading={chuvaLoading}
                    disabled={!chuvaForm.data || !chuvaForm.volume_mm}
                    className="flex-1"
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            )}

            {/* Records list */}
            {registrosChuva.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhum registro de chuva ainda.</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                {registrosChuva.slice(0, 10).map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderBottom: i < Math.min(registrosChuva.length, 10) - 1 ? '1px solid var(--borda)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CloudRain size={13} style={{ color: 'hsl(210 80% 50%)' }} />
                      <span className="text-sm" style={{ color: 'var(--fg)' }}>
                        {format(parseISO(r.data), "dd 'de' MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'hsl(210 80% 40%)' }}>
                      {r.volume_mm} mm
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Anotações ── */}
      <div className="animate-enter animate-enter-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StickyNote size={15} style={{ color: 'hsl(45 90% 38%)' }} />
            <p className="section-label" style={{ margin: 0 }}>Anotações</p>
            {anotacoes.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'hsl(45 90% 38% / 0.1)', color: 'hsl(45 90% 32%)' }}>
                {anotacoes.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={openAnotacaoModal}
            style={{ fontSize: '12px', padding: '0.35rem 0.85rem' }}
          >
            <Plus size={12} /> Nova Anotação
          </Button>
        </div>

        {anotacoes.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'hsl(45 90% 38% / 0.1)' }}>
              <StickyNote className="w-6 h-6" style={{ color: 'hsl(45 90% 38%)' }} />
            </div>
            <p className="font-semibold mb-1 text-sm" style={{ color: 'var(--fg)' }}>Nenhuma anotação</p>
            <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
              Registre observações e fotos sobre este talhão.
            </p>
            <Button size="sm" onClick={openAnotacaoModal}>
              Nova Anotação
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {anotacoes.map((ant, i) => (
              <div
                key={ant.id}
                className="card p-4 animate-enter"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>
                    {format(parseISO(ant.data), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{
                    color: 'var(--fg)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {ant.texto}
                </p>
                {ant.fotos && ant.fotos.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {ant.fotos.map((foto, fi) => (
                      <img
                        key={fi}
                        src={foto}
                        alt={`Foto ${fi + 1}`}
                        className="w-14 h-14 rounded-xl object-cover"
                        style={{ border: '1px solid var(--borda)' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Fenologia ── */}
      {talhao && (
        <div className="animate-enter animate-enter-6 mb-8">
          <FenologiaCard
            cultura={talhao.cultura}
            dataPlantio={talhao.data_plantio}
            talhaoId={talhao.id}
          />
        </div>
      )}

      </> /* end activeTab === 'info' */}

      {/* ── Modal Plantio ── */}
      <Modal
        open={plantioModal}
        onClose={() => setPlantioModal(false)}
        title={talhao.data_plantio ? 'Editar Plantio' : 'Definir Plantio'}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPlantioModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={savePlantio} loading={plantioLoading} disabled={!plantioForm.data_plantio} className="flex-1">
              {talhao.data_plantio ? 'Salvar' : 'Confirmar Plantio'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Data de plantio"
            type="date"
            value={plantioForm.data_plantio}
            onChange={e => handlePlantioDateChange(e.target.value)}
            required
          />
          <Input
            label="Data prevista de colheita"
            type="date"
            value={plantioForm.data_colheita_prevista}
            onChange={e => setPlantioForm(f => ({ ...f, data_colheita_prevista: e.target.value }))}
          />

          {plantioForm.data_plantio && talhao && (
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'hsl(160 84% 22% / 0.08)', color: 'hsl(160 84% 22%)' }}>
              <p className="font-medium">Ciclo estimado: {CICLO_CULTURA[talhao.cultura] ?? 120} dias</p>
              <p>Ao salvar, as aplicações serão (re)agendadas automaticamente com base nos produtos cadastrados na fazenda.</p>
              {produtos.length === 0 && (
                <p className="font-semibold" style={{ color: 'hsl(32 95% 38%)' }}>
                  Cadastre produtos na fazenda para que o agendamento seja gerado.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal Aplicação ── */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setAplicacaoBase(null); setEditingAplicacao(null); setModalMode('produto'); setSelectedRecomendacaoId('') }}
        title={
          editingAplicacao ? 'Editar Aplicação'
          : aplicacaoBase?.tipo === 'planejada'
            ? (form.tipo === 'realizada' ? 'Confirmar Aplicação' : 'Re-agendar Aplicação')
          : form.tipo === 'planejada' ? 'Agendar Aplicação' : 'Registrar Aplicação'
        }
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setModalOpen(false); setAplicacaoBase(null); setEditingAplicacao(null); setModalMode('produto'); setSelectedRecomendacaoId('') }} className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveAplicacao} loading={loading} disabled={!form.produto_id} className="flex-1">
              {editingAplicacao ? 'Salvar Alterações'
                : aplicacaoBase?.tipo === 'planejada'
                  ? (form.tipo === 'realizada' ? 'Confirmar Realização' : 'Re-agendar')
                : form.tipo === 'planejada' ? 'Agendar' : 'Registrar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Tipo toggle — sempre visível, inclusive ao editar (permite reverter realizada → planejada) */}
          {!aplicacaoBase && (
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-dark)' }}>
              {(['planejada', 'realizada'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: form.tipo === t ? 'var(--bg-card)' : 'transparent',
                    color: form.tipo === t ? 'var(--fg)' : 'var(--fg-muted)',
                    boxShadow: form.tipo === t ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  {t === 'planejada' ? '📅 Agendada' : '✓ Realizada'}
                </button>
              ))}
            </div>
          )}

          {aplicacaoBase?.tipo === 'planejada' && form.tipo === 'realizada' && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 80% 38%)' }}>
              Confirme os dados e registre a aplicação planejada como realizada.
            </div>
          )}

          {/* Modo: Produto direto ou Recomendação técnica */}
          {!aplicacaoBase && (
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-dark)' }}>
              {(['produto', 'recomendacao'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setModalMode(mode); setSelectedRecomendacaoId('') }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{
                    background: modalMode === mode ? 'var(--bg-card)' : 'transparent',
                    color: modalMode === mode ? 'var(--fg)' : 'var(--fg-muted)',
                    boxShadow: modalMode === mode ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  {mode === 'produto' ? 'Produto direto' : 'Recomendação técnica'}
                </button>
              ))}
            </div>
          )}

          {/* Modo Recomendação */}
          {modalMode === 'recomendacao' && recomendacoes.length > 0 && (
            <Select
              label="Recomendação do agrônomo"
              value={selectedRecomendacaoId}
              onChange={e => handleSelectRecomendacao(e.target.value)}
              options={recomendacoes.map(r => ({ value: r.id, label: `${r.nome} (até ${r.data_fim})` }))}
              placeholder="Selecione a recomendação"
            />
          )}
          {modalMode === 'recomendacao' && recomendacoes.length === 0 && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'hsl(45 100% 96%)', color: 'hsl(32 95% 38%)' }}>
              Nenhuma recomendação técnica cadastrada para esta fazenda. Cadastre em Recomendações.
            </div>
          )}

          <Select
            label="Produto"
            value={form.produto_id}
            onChange={e => setForm(f => ({ ...f, produto_id: e.target.value }))}
            options={produtos.map(p => {
              const estoque = p.quantidade_disponivel != null ? ` · ${p.quantidade_disponivel} ${p.unidade_quantidade || 'un'}` : ''
              return { value: p.id, label: `${p.nome}${p.prazo_medio_aplicacao ? ` · sugestão: cada ${p.prazo_medio_aplicacao}d` : ''}${estoque}` }
            })}
            placeholder="Selecione o produto"
          />
          <Input
            label="Data da aplicação"
            type="date"
            value={form.data_aplicacao}
            onChange={e => setForm(f => ({ ...f, data_aplicacao: e.target.value }))}
          />
          {form.produto_id && (() => {
            const prod = produtos.find(p => p.id === form.produto_id)
            if (!prod || !form.data_aplicacao || !prod.prazo_medio_aplicacao) return null
            // Apenas sugestão visual — não afeta o salvamento
            const [dy, dm, dd] = form.data_aplicacao.split('-').map(Number)
            const proxima = addDays(new Date(dy, dm - 1, dd), prod.prazo_medio_aplicacao)
            return (
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 100% 35%)' }}>
                <span className="font-medium">Sugestão de próxima aplicação:</span>{' '}
                {format(proxima, 'dd/MM/yyyy')} (+{prod.prazo_medio_aplicacao} dias)
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dose" type="number" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="Ex: 2.5" />
            <Select
              label="Unidade"
              value={form.unidade_dose}
              onChange={e => setForm(f => ({ ...f, unidade_dose: e.target.value }))}
              options={[
                { value: 'L/ha', label: 'L/ha' },
                { value: 'kg/ha', label: 'kg/ha' },
                { value: 'g/ha', label: 'g/ha' },
                { value: 'ml/ha', label: 'ml/ha' },
              ]}
            />
          </div>
          <Input
            label="Área aplicada (ha)"
            type="number"
            value={form.area_aplicada}
            onChange={e => setForm(f => ({ ...f, area_aplicada: e.target.value }))}
            placeholder={`Padrão: ${talhao.area} ha`}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Clima"
              value={form.clima}
              onChange={e => setForm(f => ({ ...f, clima: e.target.value }))}
              options={[
                { value: 'ensolarado', label: 'Ensolarado' },
                { value: 'nublado', label: 'Nublado' },
                { value: 'parcialmente_nublado', label: 'Parcialmente nublado' },
                { value: 'vento', label: 'Com vento' },
              ]}
              placeholder="Selecionar clima"
            />
            <Input label="Temperatura (°C)" type="number" value={form.temperatura} onChange={e => setForm(f => ({ ...f, temperatura: e.target.value }))} placeholder="Ex: 28" />
          </div>
          <Textarea
            label="Observações"
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            placeholder="Anotações sobre a aplicação..."
          />
          <PhotoPicker label="Fotos da aplicação" photos={fotos} onChange={setFotos} maxPhotos={4} />
        </div>
      </Modal>

      {/* ── Modal Registrar Etapa de Semeadura ── */}
      {talhao && (
        <Modal
          open={etapaModal}
          onClose={() => { setEtapaModal(false); setEtapaError('') }}
          title={`Registrar ${etapaOrdinal(etapas.length + 1)} de Semeadura`}
          footer={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setEtapaModal(false); setEtapaError('') }} className="flex-1">Cancelar</Button>
              <Button
                onClick={salvarEtapa}
                loading={etapaLoading}
                disabled={!etapaForm.area_semeada || Number(etapaForm.area_semeada) <= 0}
                className="flex-1"
              >
                Salvar Etapa
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Info about remaining area */}
            <div className="rounded-xl px-4 py-3 text-xs space-y-1"
              style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 100% 35%)' }}>
              <p className="font-semibold">Talhão: {talhao.area} ha total</p>
              {totalSemeado > 0 && (
                <p>Já semeado: {totalSemeado.toFixed(2)} ha · Disponível: <strong>{areaRestante.toFixed(2)} ha</strong></p>
              )}
            </div>

            <Input
              label={`Área semeada nesta etapa (ha) — máx ${areaRestante.toFixed(2)} ha`}
              type="number"
              value={etapaForm.area_semeada}
              onChange={e => {
                setEtapaError('')
                const val = e.target.value
                if (val === '' || Number(val) >= 0) setEtapaForm(f => ({ ...f, area_semeada: val }))
              }}
              placeholder={`Ex: ${areaRestante.toFixed(1)}`}
              required
            />
            <Input
              label="Data da semeadura"
              type="date"
              value={etapaForm.data_semeadura}
              onChange={e => setEtapaForm(f => ({ ...f, data_semeadura: e.target.value }))}
            />
            <Textarea
              label="Observações (opcional)"
              value={etapaForm.observacoes}
              onChange={e => setEtapaForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Condições, equipamento, operador..."
            />
            {etapaError && (
              <p className="text-xs font-medium px-3 py-2 rounded-lg"
                style={{ background: 'hsl(4 80% 97%)', color: 'hsl(4 72% 45%)' }}>
                {etapaError}
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* ── Modal Anotação ── */}
      <Modal
        open={anotacaoModal}
        onClose={() => setAnotacaoModal(false)}
        title="Nova Anotação"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setAnotacaoModal(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={salvarAnotacao}
              loading={anotacaoLoading}
              disabled={!anotacaoForm.texto.trim()}
              className="flex-1"
            >
              Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Data"
            type="date"
            value={anotacaoForm.data}
            onChange={e => setAnotacaoForm(f => ({ ...f, data: e.target.value }))}
          />
          <Textarea
            label="Texto"
            value={anotacaoForm.texto}
            onChange={e => setAnotacaoForm(f => ({ ...f, texto: e.target.value }))}
            placeholder="Observações sobre o talhão..."
            required
          />
          <PhotoPicker
            label="Fotos (opcional, máx 3)"
            photos={anotacaoFotos}
            onChange={setAnotacaoFotos}
            maxPhotos={3}
          />
        </div>
      </Modal>
    </div>
  )
}
