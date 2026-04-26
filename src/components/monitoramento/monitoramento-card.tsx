'use client'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bug, Leaf, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { MonitoramentoPraga, CulturaType } from '@/types'
import { SeveridadeBadge } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'

interface MonitoramentoCardProps {
  registro: MonitoramentoPraga
  cultura: CulturaType
  onEdit: (r: MonitoramentoPraga) => void
  onDelete: (id: string) => void
}

export function MonitoramentoCard({ registro, cultura, onEdit, onDelete }: MonitoramentoCardProps) {
  const [expanded, setExpanded] = useState(false)
  const agenteLabel = getAgenteLabel(cultura, registro.tipo === 'praga' ? 'praga' : 'doenca', registro.agente)
  const dataFormatada = (() => {
    try { return format(parseISO(registro.data), 'dd/MM/yyyy', { locale: ptBR }) }
    catch { return registro.data }
  })()

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--borda)',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: registro.tipo === 'praga' ? 'hsl(32 95% 38% / 0.12)' : 'hsl(210 100% 40% / 0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {registro.tipo === 'praga'
            ? <Bug size={14} color="hsl(32 95% 38%)" />
            : <Leaf size={14} color="hsl(210 100% 40%)" />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.3 }}>{agenteLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
            {registro.tipo === 'praga' ? 'Praga' : 'Doença'} · {dataFormatada}
          </div>
        </div>
        <SeveridadeBadge severidade={registro.severidade} size="sm" />
        <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-subtle)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Area + quick info */}
      {registro.area_afetada != null && registro.area_afetada > 0 && (
        <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
          Área afetada: <strong style={{ color: 'var(--fg)' }}>{registro.area_afetada}%</strong>
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          {registro.observacoes && (
            <p style={{ fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.5, margin: 0 }}>
              {registro.observacoes}
            </p>
          )}
          {registro.fotos && registro.fotos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {registro.fotos.map((f, i) => (
                <img key={i} src={f} alt="" style={{ width: 60, height: 60, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--borda)' }} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => onEdit(registro)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', cursor: 'pointer' }}
            >
              <Pencil size={11} /> Editar
            </button>
            <button
              onClick={() => onDelete(registro.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid hsl(0 72% 51% / 0.25)', background: 'hsl(0 72% 51% / 0.08)', color: 'hsl(0 72% 51%)', cursor: 'pointer' }}
            >
              <Trash2 size={11} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
