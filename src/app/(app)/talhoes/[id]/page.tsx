'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { getDB } from '@/lib/db'
import { criarAplicacao } from '@/lib/db/aplicacoes'
import { agendarAplicacoesPorPlantio, criarOuAtualizarSafra, CICLO_CULTURA } from '@/lib/db/agronomo'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AplicacaoCard } from '@/components/aplicacoes/aplicacao-card'
import { culturaLabel, culturaIcon, gerarId } from '@/lib/utils'
import type { Talhao, Fazenda, Produto, Aplicacao, Pluviometro, RegistroChuva, Anotacao, StatusSemeadura } from '@/types'
import { PhotoPicker } from '@/components/ui/photo-picker'
import {
  ArrowLeft, Plus, FlaskConical, AlertTriangle, Calendar,
  Sprout, CheckCircle2, Clock3, ChevronDown, ChevronUp, Pencil, RotateCcw,
  CloudRain, StickyNote, Droplets,
} from 'lucide-react'
import Link from 'next/link'
import { addDays, differenceInDays, parseISO, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

const TODAY = new Date().toISOString().split('T')[0]

export default function TalhaoPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [talhao, setTalhao] = useState<Talhao | null>(null)
  const [fazenda, setFazenda] = useState<Fazenda | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [aplicacoes, setAplicacoes] = useState<Aplicacao[]>([])

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
  const [form, setForm] = useState({
    produto_id: '',
    data_aplicacao: TODAY,
    dose: '',
    unidade_dose: 'L/ha',
    area_aplicada: '',
    observacoes: '',
    clima: '',
    temperatura: '',
  })
  const [fotos, setFotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

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
    const [faz, prods, apps] = await Promise.all([
      db.fazendas.get(t.fazenda_id),
      db.produtos.where('fazenda_id').equals(t.fazenda_id).toArray(),
      db.aplicacoes.where('talhao_id').equals(id).reverse().sortBy('data_aplicacao'),
    ])
    setFazenda(faz || null)
    setProdutos(prods)
    const enriched = await Promise.all(apps.map(async a => {
      const prod = await db.produtos.get(a.produto_id)
      return { ...a, produto: prod }
    }))
    setAplicacoes(enriched as Aplicacao[])

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
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // ── Plantio ──────────────────────────────────────────────────────────────
  function openPlantioModal() {
    setPlantioForm({
      data_plantio: talhao?.data_plantio || TODAY,
      data_colheita_prevista: talhao?.data_colheita_prevista || '',
      status_semeadura: talhao?.status_semeadura || '',
      area_semeada: talhao?.area_semeada != null ? String(talhao.area_semeada) : '',
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

      const prods = await db.produtos.where('fazenda_id').equals(talhao.fazenda_id).toArray()
      await Promise.all([
        agendarAplicacoesPorPlantio(updated, prods, user.id),
        criarOuAtualizarSafra(updated),
      ])
      await loadData()
      setPlantioModal(false)
    } finally { setPlantioLoading(false) }
  }

  // ── Aplicação ────────────────────────────────────────────────────────────
  function openAplicacaoModal(planejada?: Aplicacao) {
    setAplicacaoBase(planejada || null)
    setForm({
      produto_id: planejada?.produto_id || '',
      data_aplicacao: planejada?.data_aplicacao || TODAY,
      dose: planejada?.dose?.toString() || '',
      unidade_dose: planejada?.unidade_dose || 'L/ha',
      area_aplicada: planejada?.area_aplicada?.toString() || '',
      observacoes: planejada?.observacoes || '',
      clima: planejada?.clima || '',
      temperatura: planejada?.temperatura?.toString() || '',
    })
    setFotos([])
    setModalOpen(true)
  }

  async function handleSaveAplicacao() {
    if (!user || !form.produto_id || !form.data_aplicacao) return
    const prod = produtos.find(p => p.id === form.produto_id)
    if (!prod) return
    setLoading(true)
    try {
      const db = getDB()
      if (aplicacaoBase?.id && aplicacaoBase.tipo === 'planejada') {
        await db.aplicacoes.delete(aplicacaoBase.id)
      }
      await criarAplicacao({
        talhao_id: id,
        produto_id: form.produto_id,
        tipo: 'realizada',
        data_aplicacao: form.data_aplicacao,
        prazo_produto: prod.prazo_medio_aplicacao,
        dose: form.dose ? Number(form.dose) : undefined,
        unidade_dose: form.unidade_dose,
        area_aplicada: form.area_aplicada ? Number(form.area_aplicada) : talhao?.area,
        observacoes: form.observacoes,
        clima: form.clima,
        temperatura: form.temperatura ? Number(form.temperatura) : undefined,
        fotos: fotos.length > 0 ? fotos : undefined,
        usuario_id: user.id,
      })
      await loadData()
      setModalOpen(false)
      setAplicacaoBase(null)
      setFotos([])
      setForm({
        produto_id: '', data_aplicacao: TODAY,
        dose: '', unidade_dose: 'L/ha', area_aplicada: '', observacoes: '', clima: '', temperatura: '',
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

  // ── Derived data ─────────────────────────────────────────────────────────
  const planejadas = aplicacoes.filter(a => a.tipo === 'planejada')
  const realizadas = aplicacoes.filter(a => a.tipo !== 'planejada')
  const atrasadas = [...planejadas, ...realizadas].filter(a => a.status === 'atrasado')
  const proximas = [...planejadas, ...realizadas].filter(a => a.status === 'proximo' || a.status === 'hoje')

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

  // Semeadura progress
  const semeaduraPct = talhao.area > 0 && talhao.area_semeada != null
    ? Math.min(100, (talhao.area_semeada / talhao.area) * 100)
    : 0
  const semeaduraStatus = talhao.status_semeadura
  const semeaduraColors = semeaduraStatus ? STATUS_SEMEADURA_COLORS[semeaduraStatus] : null

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

            {/* Semeadura progress — only when area > 0 */}
            {talhao.area > 0 && talhao.area_semeada != null && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--borda)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>Semeadura</span>
                    {semeaduraStatus && semeaduraColors && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: semeaduraColors.color, background: semeaduraColors.bg }}
                      >
                        {STATUS_SEMEADURA_LABELS[semeaduraStatus]}
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                    {talhao.area_semeada} / {talhao.area} ha ({semeaduraPct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-dark)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-blue-400"
                    style={{ width: `${semeaduraPct}%` }}
                  />
                </div>
              </div>
            )}

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

      {/* Alert cards */}
      {(atrasadas.length > 0 || proximas.length > 0) && (
        <div className="animate-enter animate-enter-2 grid grid-cols-2 gap-3 mb-5">
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
                        <span>{format(parseISO(a.data_aplicacao), "dd/MM/yyyy")}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ color: sc.color, background: sc.bg }}>
                          {a.status === 'atrasado' ? 'Atrasado' : a.status === 'hoje' ? 'Hoje' : a.status === 'proximo' ? 'Próximo' : 'No prazo'}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openAplicacaoModal(a)}
                      style={{ background: 'hsl(160 84% 22%)', color: 'white', fontSize: '11px', padding: '0.35rem 0.75rem' }}
                    >
                      <CheckCircle2 size={12} /> Realizar
                    </Button>
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
            <p className="section-label" style={{ margin: 0 }}>Histórico</p>
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
            <div className="space-y-3">
              {realizadas.map((a, i) => (
                <div key={a.id} className="animate-enter" style={{ animationDelay: `${(i + 3) * 50}ms` }}>
                  <AplicacaoCard aplicacao={a} showTalhao={false} />
                </div>
              ))}
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

          {/* Semeadura fields */}
          <Select
            label="Status de semeadura"
            value={plantioForm.status_semeadura}
            onChange={e => setPlantioForm(f => ({ ...f, status_semeadura: e.target.value as StatusSemeadura | '' }))}
            options={[
              { value: 'nao_iniciada', label: 'Não iniciada' },
              { value: 'em_andamento', label: 'Em andamento' },
              { value: 'finalizada', label: 'Finalizada' },
            ]}
            placeholder="Selecionar status"
          />
          <Input
            label={`Área semeada (ha) — máx ${talhao.area} ha`}
            type="number"
            value={plantioForm.area_semeada}
            onChange={e => {
              const val = e.target.value
              if (val === '' || Number(val) <= talhao.area) {
                setPlantioForm(f => ({ ...f, area_semeada: val }))
              }
            }}
            placeholder={`Ex: ${talhao.area}`}
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
        onClose={() => { setModalOpen(false); setAplicacaoBase(null) }}
        title={aplicacaoBase?.tipo === 'planejada' ? 'Confirmar Aplicação' : 'Registrar Aplicação'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setModalOpen(false); setAplicacaoBase(null) }} className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveAplicacao} loading={loading} disabled={!form.produto_id} className="flex-1">
              {aplicacaoBase?.tipo === 'planejada' ? 'Confirmar Realização' : 'Registrar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {aplicacaoBase?.tipo === 'planejada' && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 80% 38%)' }}>
              Confirme os dados e registre a aplicação planejada como realizada.
            </div>
          )}
          <Select
            label="Produto"
            value={form.produto_id}
            onChange={e => setForm(f => ({ ...f, produto_id: e.target.value }))}
            options={produtos.map(p => ({ value: p.id, label: `${p.nome} (cada ${p.prazo_medio_aplicacao}d)` }))}
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
            if (!prod || !form.data_aplicacao) return null
            const proxima = new Date(form.data_aplicacao)
            proxima.setDate(proxima.getDate() + prod.prazo_medio_aplicacao)
            return (
              <div className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 100% 35%)' }}>
                <span className="font-medium">Próxima aplicação:</span>{' '}
                {proxima.toLocaleDateString('pt-BR')} (+{prod.prazo_medio_aplicacao} dias)
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
