'use client'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Lightbulb, FlaskConical, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { MonitoramentoPraga, Produto, Aplicacao, CulturaType } from '@/types'
import { SEVERIDADE_ORDER, SeveridadeBadge } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'

const TODAY = format(new Date(), 'yyyy-MM-dd')

// Recommended product type per agent type
const TIPO_PRODUTO_RECOMENDADO: Record<'praga' | 'doenca', Produto['tipo']> = {
  praga:  'inseticida',
  doenca: 'fungicida',
}

const TIPO_LABEL: Record<Produto['tipo'], string> = {
  herbicida:    'Herbicida',
  fungicida:    'Fungicida',
  inseticida:   'Inseticida',
  fertilizante: 'Fertilizante',
  defensivo:    'Defensivo',
}

interface SugestaoItem {
  monitoramento: MonitoramentoPraga
  agenteLabel: string
  tipoProdutoRecomendado: Produto['tipo']
  produtosFiltrados: Produto[]
}

interface MonitoramentoSugestaoProps {
  monitoramentos: MonitoramentoPraga[]
  produtos: Produto[]
  cultura: CulturaType
  talhaoArea: number
  onAgendar: (prefill: Partial<Aplicacao>) => void
}

export function MonitoramentoSugestao({
  monitoramentos, produtos, cultura, talhaoArea, onAgendar,
}: MonitoramentoSugestaoProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded]   = useState(true)
  // Per-sugestão state: selected product + dose
  const [selections, setSelections] = useState<Record<string, { produto_id: string; dose: string; unidade_dose: string; data_aplicacao: string }>>({})

  const sugestoes: SugestaoItem[] = useMemo(() => {
    // Only most-recent severo/critico per agente (de-duplicated)
    const seen = new Set<string>()
    return [...monitoramentos]
      .filter(m => (m.severidade === 'severo' || m.severidade === 'critico') && !dismissed.has(m.id))
      .sort((a, b) => SEVERIDADE_ORDER.indexOf(b.severidade) - SEVERIDADE_ORDER.indexOf(a.severidade))
      .filter(m => {
        if (seen.has(m.agente)) return false
        seen.add(m.agente)
        return true
      })
      .map(m => {
        const tipo = m.tipo === 'praga' ? 'praga' : 'doenca'
        const tipoProduto = TIPO_PRODUTO_RECOMENDADO[tipo]
        return {
          monitoramento: m,
          agenteLabel: getAgenteLabel(cultura, tipo, m.agente),
          tipoProdutoRecomendado: tipoProduto,
          produtosFiltrados: produtos.filter(p => p.tipo === tipoProduto),
        }
      })
  }, [monitoramentos, dismissed, produtos, cultura])

  if (sugestoes.length === 0) return null

  function getSelection(monId: string, tipoProduto: Produto['tipo']) {
    return selections[monId] ?? {
      produto_id: '',
      dose: '',
      unidade_dose: 'L/ha',
      data_aplicacao: TODAY,
    }
  }

  function updateSelection(monId: string, patch: Partial<typeof selections[string]>) {
    setSelections(s => ({ ...s, [monId]: { ...getSelection(monId, 'inseticida'), ...patch } }))
  }

  function handleAgendar(s: SugestaoItem) {
    const sel = getSelection(s.monitoramento.id, s.tipoProdutoRecomendado)
    const obs = `Gerado a partir do monitoramento de ${s.agenteLabel} (${s.monitoramento.severidade})`
    onAgendar({
      produto_id:     sel.produto_id || undefined,
      data_aplicacao: sel.data_aplicacao,
      dose:           sel.dose ? Number(sel.dose) : undefined,
      unidade_dose:   sel.unidade_dose,
      area_aplicada:  talhaoArea,
      observacoes:    obs,
      tipo:           'planejada',
    })
  }

  return (
    <div style={{
      background: 'hsl(45 100% 97%)',
      border: '1.5px solid hsl(38 90% 50% / 0.35)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <Lightbulb size={15} style={{ color: 'hsl(38 90% 40%)', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'hsl(38 90% 35%)' }}>
          {sugestoes.length} sugestão{sugestoes.length > 1 ? 'ões' : ''} de aplicação baseada{sugestoes.length > 1 ? 's' : ''} no monitoramento
        </span>
        {expanded ? <ChevronUp size={14} color="hsl(38 90% 40%)" /> : <ChevronDown size={14} color="hsl(38 90% 40%)" />}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sugestoes.map(s => {
            const sel = getSelection(s.monitoramento.id, s.tipoProdutoRecomendado)
            const tipoProdLabel = TIPO_LABEL[s.tipoProdutoRecomendado]

            return (
              <div key={s.monitoramento.id} style={{
                background: '#fff',
                border: '1px solid hsl(38 90% 50% / 0.20)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{s.agenteLabel}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                      Recomendado: <strong style={{ color: 'hsl(160 84% 22%)' }}>{tipoProdLabel}</strong>
                    </div>
                  </div>
                  <SeveridadeBadge severidade={s.monitoramento.severidade} size="sm" />
                  <button
                    onClick={() => setDismissed(d => new Set([...d, s.monitoramento.id]))}
                    title="Dispensar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-subtle)', flexShrink: 0 }}
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Form row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: 8 }}>
                  {/* Produto select */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 3 }}>
                      Produto {s.produtosFiltrados.length === 0 && <span style={{ color: 'hsl(0 72% 51%)' }}>(nenhum cadastrado)</span>}
                    </label>
                    <select
                      value={sel.produto_id}
                      onChange={e => updateSelection(s.monitoramento.id, { produto_id: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 7, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 12 }}
                    >
                      <option value="">Selecionar...</option>
                      {s.produtosFiltrados.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dose */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 3 }}>Dose</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={sel.dose}
                      onChange={e => updateSelection(s.monitoramento.id, { dose: e.target.value })}
                      placeholder="Ex: 1.5"
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 7, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 12 }}
                    />
                  </div>

                  {/* Unidade */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 3 }}>Unidade</label>
                    <select
                      value={sel.unidade_dose}
                      onChange={e => updateSelection(s.monitoramento.id, { unidade_dose: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 7, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 12 }}
                    >
                      {['L/ha', 'mL/ha', 'kg/ha', 'g/ha', 'L', 'kg'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* Date row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 3 }}>Data prevista</label>
                    <input
                      type="date"
                      value={sel.data_aplicacao}
                      onChange={e => updateSelection(s.monitoramento.id, { data_aplicacao: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 7, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 12 }}
                    />
                  </div>
                  <button
                    onClick={() => handleAgendar(s)}
                    style={{
                      marginTop: 16,
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 8, border: 'none',
                      background: 'hsl(160 84% 22%)', color: '#fff',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <FlaskConical size={12} /> Agendar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
