'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import type { Fazenda, Talhao } from '@/types'
import {
  FlaskConical,
  Gauge,
  Layers,
  CheckSquare,
  Square,
  Droplets,
  Calculator,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TalhaoComVolume extends Talhao {
  fazenda?: Fazenda
  volume: number
  tanques: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  accent: string
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--borda)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}1a` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <p className="text-xs section-label mt-1">{label}</p>
      <p className="font-display text-2xl font-bold leading-none" style={{ color: 'var(--fg)' }}>
        {value}
        <span className="text-sm font-normal ml-1" style={{ color: 'var(--fg-muted)' }}>
          {unit}
        </span>
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaldaPage() {
  const { user } = useAuthStore()
  const { fazendas, setFazendas } = useAppStore()
  const [talhoes, setTalhoes] = useState<(Talhao & { fazenda?: Fazenda })[]>([])
  const [loading, setLoading] = useState(true)

  // Inputs
  const [taxa, setTaxa] = useState<string>('')
  const [capacidade, setCapacidade] = useState<string>('')
  const [filtroFazenda, setFiltroFazenda] = useState<string>('')
  const [sel, setSel] = useState<Set<string>>(new Set())

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const db = getDB()
      const fazs = await db.fazendas.where('usuario_id').equals(user.id).toArray()
      setFazendas(fazs)
      const fazIds = fazs.map((f) => f.id)
      const tals = await db.talhoes
        .where('fazenda_id')
        .anyOf(fazIds.length ? fazIds : [''])
        .toArray()
      const enriched = tals.map((t) => ({
        ...t,
        fazenda: fazs.find((f) => f.id === t.fazenda_id),
      }))
      setTalhoes(enriched)
    } finally {
      setLoading(false)
    }
  }, [user, setFazendas])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggle = (id: string) => {
    setSel((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every((id) => sel.has(id))
    setSel((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const taxaNum = parseFloat(taxa) || 0
  const capacidadeNum = parseFloat(capacidade) || 0

  const talhoesVisiveis = filtroFazenda
    ? talhoes.filter((t) => t.fazenda_id === filtroFazenda)
    : talhoes

  const selecionados = talhoes.filter((t) => sel.has(t.id))

  const talhoesComVolume: TalhaoComVolume[] = selecionados.map((t) => {
    const volume = t.area * taxaNum
    const tanques = capacidadeNum > 0 ? Math.ceil(volume / capacidadeNum) : 0
    return { ...t, volume, tanques }
  })

  const volumeTotal = talhoesComVolume.reduce((s, t) => s + t.volume, 0)
  const numTanques = capacidadeNum > 0 ? Math.ceil(volumeTotal / capacidadeNum) : 0
  const sobra = numTanques > 0 ? numTanques * capacidadeNum - volumeTotal : 0

  const hasResults = taxaNum > 0 && capacidadeNum > 0 && selecionados.length > 0

  // ── Group talhões by fazenda for display ───────────────────────────────────

  const groupedTalhoes = talhoesVisiveis.reduce<Record<string, { fazenda: Fazenda | undefined; items: typeof talhoesVisiveis }>>((acc, t) => {
    const key = t.fazenda_id
    if (!acc[key]) acc[key] = { fazenda: t.fazenda, items: [] }
    acc[key].items.push(t)
    return acc
  }, {})

  const fazendaOptions = fazendas.map((f) => ({ value: f.id, label: f.nome }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 md:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-enter-1 mb-8">
        <p className="section-label mb-1">Pulverização</p>
        <h1
          className="font-display text-[2rem] font-bold"
          style={{ color: 'var(--fg)' }}
        >
          Cálculo de Calda
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          Planeje sua operação de aplicação
        </p>
      </div>

      {/* 2-column layout */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ── LEFT: Inputs ── */}
        <div className="flex flex-col gap-4 animate-enter-2">
          {/* Taxa + Capacidade */}
          <div
            className="card p-5 flex flex-col gap-4"
          >
            <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--fg)' }}>
              <Gauge size={15} style={{ color: 'hsl(210 100% 40%)' }} />
              Parâmetros de aplicação
            </h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs section-label">Taxa de aplicação</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="ex: 150"
                  value={taxa}
                  onChange={(e) => setTaxa(e.target.value)}
                  className="field-input pr-12"
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                  style={{ color: 'var(--fg-subtle)', pointerEvents: 'none' }}
                >
                  L/ha
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs section-label">Capacidade do tanque</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="ex: 2000"
                  value={capacidade}
                  onChange={(e) => setCapacidade(e.target.value)}
                  className="field-input pr-8"
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                  style={{ color: 'var(--fg-subtle)', pointerEvents: 'none' }}
                >
                  L
                </span>
              </div>
            </div>
          </div>

          {/* Talhão selector */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--fg)' }}>
                <Layers size={15} style={{ color: 'hsl(160 84% 22%)' }} />
                Talhões
              </h2>
              {sel.size > 0 && (
                <button
                  onClick={() => setSel(new Set())}
                  className="text-xs"
                  style={{ color: 'var(--fg-subtle)' }}
                >
                  Limpar seleção
                </button>
              )}
            </div>

            {/* Fazenda filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs section-label">Filtrar por fazenda</label>
              <select
                value={filtroFazenda}
                onChange={(e) => setFiltroFazenda(e.target.value)}
                className="field-input"
              >
                <option value="">Todas as fazendas</option>
                {fazendaOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Talhão checkboxes grouped by fazenda */}
            {loading ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--fg-subtle)' }}>
                Carregando...
              </p>
            ) : talhoesVisiveis.length === 0 ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}
              >
                <FlaskConical size={22} style={{ color: 'var(--fg-subtle)', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  Nenhum talhão encontrado.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedTalhoes).map(([fazId, group]) => {
                  const groupIds = group.items.map((t) => t.id)
                  const allGroupSel = groupIds.every((id) => sel.has(id))
                  return (
                    <div key={fazId} className="flex flex-col gap-1.5">
                      {/* Fazenda header — click to toggle all in group */}
                      <button
                        onClick={() => toggleAll(groupIds)}
                        className="flex items-center gap-2 px-1 py-0.5 text-left"
                      >
                        {allGroupSel ? (
                          <CheckSquare size={14} style={{ color: 'hsl(160 84% 22%)', flexShrink: 0 }} />
                        ) : (
                          <Square size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                        )}
                        <span
                          className="text-xs font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--fg-muted)' }}
                        >
                          {group.fazenda?.nome ?? 'Fazenda'}
                        </span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--fg-subtle)' }}>
                          {groupIds.filter((id) => sel.has(id)).length}/{groupIds.length}
                        </span>
                      </button>

                      {/* Individual talhões */}
                      <div className="flex flex-col gap-1.5 pl-1">
                        {group.items.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => toggle(t.id)}
                            className="flex items-center gap-3 p-3 rounded-xl transition text-left"
                            style={{
                              background: sel.has(t.id)
                                ? 'hsl(160 84% 22% / 0.08)'
                                : 'var(--bg)',
                              border: `1px solid ${
                                sel.has(t.id)
                                  ? 'hsl(160 84% 22% / 0.3)'
                                  : 'var(--borda)'
                              }`,
                            }}
                          >
                            {sel.has(t.id) ? (
                              <CheckSquare
                                size={16}
                                style={{ color: 'hsl(160 84% 22%)', flexShrink: 0 }}
                              />
                            ) : (
                              <Square
                                size={16}
                                style={{ color: 'var(--fg-subtle)', flexShrink: 0 }}
                              />
                            )}
                            <span style={{ color: 'var(--fg)' }} className="text-sm">
                              {t.nome}
                            </span>
                            <span
                              className="ml-auto text-xs"
                              style={{ color: 'var(--fg-muted)' }}
                            >
                              {fmt(t.area, 1)} ha
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Selection summary */}
            {sel.size > 0 && (
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {sel.size} talhão{sel.size !== 1 ? 'ões' : ''} selecionado
                {sel.size !== 1 ? 's' : ''} ·{' '}
                {fmt(
                  selecionados.reduce((s, t) => s + t.area, 0),
                  1
                )}{' '}
                ha total
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="flex flex-col gap-4 animate-enter-3">
          {!hasResults ? (
            <div
              className="rounded-2xl p-10 text-center flex flex-col items-center gap-3"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--borda)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'hsl(160 84% 22% / 0.08)' }}
              >
                <Calculator size={24} style={{ color: 'hsl(160 84% 22%)' }} />
              </div>
              <p className="font-semibold" style={{ color: 'var(--fg)' }}>
                Preencha os dados ao lado
              </p>
              <p className="text-sm max-w-xs" style={{ color: 'var(--fg-muted)' }}>
                Informe a taxa de aplicação, a capacidade do tanque e selecione ao menos um
                talhão para ver o resultado.
              </p>
            </div>
          ) : (
            <>
              {/* Summary stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={<Droplets size={16} />}
                  label="Volume total"
                  value={fmt(volumeTotal)}
                  unit="L"
                  accent="hsl(210 100% 40%)"
                />
                <StatCard
                  icon={<FlaskConical size={16} />}
                  label="Nº de tanques"
                  value={String(numTanques)}
                  unit="tan."
                  accent="hsl(160 84% 22%)"
                />
                <StatCard
                  icon={<Gauge size={16} />}
                  label="Sobra"
                  value={fmt(sobra)}
                  unit="L"
                  accent="hsl(36 90% 40%)"
                />
              </div>

              {/* Summary card */}
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--borda)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--fg)' }}>
                  <Calculator size={15} style={{ color: 'hsl(160 84% 22%)' }} />
                  Resumo
                </h2>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span style={{ color: 'var(--fg-muted)' }}>Taxa de aplicação</span>
                  <span className="text-right font-medium" style={{ color: 'var(--fg)' }}>
                    {fmt(taxaNum, 0)} L/ha
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>Capacidade do tanque</span>
                  <span className="text-right font-medium" style={{ color: 'var(--fg)' }}>
                    {fmt(capacidadeNum, 0)} L
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>Área total selecionada</span>
                  <span className="text-right font-medium" style={{ color: 'var(--fg)' }}>
                    {fmt(selecionados.reduce((s, t) => s + t.area, 0), 1)} ha
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>Volume total</span>
                  <span className="text-right font-bold" style={{ color: 'hsl(210 100% 40%)' }}>
                    {fmt(volumeTotal)} L
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>Tanques necessários</span>
                  <span className="text-right font-bold" style={{ color: 'hsl(160 84% 22%)' }}>
                    {numTanques}
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>Sobra no último tanque</span>
                  <span className="text-right font-bold" style={{ color: 'hsl(36 90% 40%)' }}>
                    {fmt(sobra)} L
                  </span>
                </div>
              </div>

              {/* Per-talhão table */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--borda)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="p-5 pb-3 flex items-center gap-2">
                  <Layers size={15} style={{ color: 'hsl(160 84% 22%)' }} />
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
                    Distribuição por talhão
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--borda)' }}>
                        {['Talhão', 'Área (ha)', 'Volume (L)', 'Tanques'].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-2.5 text-left text-xs font-semibold section-label"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {talhoesComVolume.map((t, i) => (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom:
                              i < talhoesComVolume.length - 1
                                ? '1px solid var(--borda)'
                                : 'none',
                          }}
                        >
                          <td className="px-5 py-3" style={{ color: 'var(--fg)' }}>
                            <span className="font-medium">{t.nome}</span>
                            {t.fazenda && (
                              <span
                                className="block text-xs"
                                style={{ color: 'var(--fg-muted)' }}
                              >
                                {t.fazenda.nome}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 tabular-nums" style={{ color: 'var(--fg-muted)' }}>
                            {fmt(t.area, 1)}
                          </td>
                          <td
                            className="px-5 py-3 tabular-nums font-medium"
                            style={{ color: 'hsl(210 100% 40%)' }}
                          >
                            {fmt(t.volume)}
                          </td>
                          <td
                            className="px-5 py-3 tabular-nums font-semibold"
                            style={{ color: 'hsl(160 84% 22%)' }}
                          >
                            {t.tanques}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--borda)', background: 'var(--bg)' }}>
                        <td className="px-5 py-3 font-semibold text-xs section-label">
                          TOTAL
                        </td>
                        <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: 'var(--fg)' }}>
                          {fmt(selecionados.reduce((s, t) => s + t.area, 0), 1)}
                        </td>
                        <td
                          className="px-5 py-3 tabular-nums font-bold"
                          style={{ color: 'hsl(210 100% 40%)' }}
                        >
                          {fmt(volumeTotal)}
                        </td>
                        <td
                          className="px-5 py-3 tabular-nums font-bold"
                          style={{ color: 'hsl(160 84% 22%)' }}
                        >
                          {numTanques}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
