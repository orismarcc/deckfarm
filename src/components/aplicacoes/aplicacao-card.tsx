import { cn, formatDate, culturaLabel, culturaIcon, produtoTipoLabel, diasParaProxima } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Aplicacao } from '@/types'
import { Calendar, Droplets, MapPin } from 'lucide-react'

interface AplicacaoCardProps {
  aplicacao: Aplicacao
  showTalhao?: boolean
}

const accentMap: Record<string, { color: string; bg: string }> = {
  atrasado:        { color: 'hsl(4 72% 50%)',    bg: 'hsl(4 86% 96%)' },
  hoje:            { color: 'hsl(210 100% 45%)',  bg: 'hsl(210 100% 96%)' },
  proximo:         { color: 'hsl(38 70% 38%)',    bg: 'hsl(38 92% 95%)' },
  dentro_do_prazo: { color: 'hsl(160 84% 22%)',   bg: 'hsl(160 84% 96%)' },
}

export function AplicacaoCard({ aplicacao, showTalhao = true }: AplicacaoCardProps) {
  const dias = diasParaProxima(aplicacao.proxima_aplicacao)
  const acc = accentMap[aplicacao.status] || accentMap.dentro_do_prazo

  return (
    <div
      className="bg-white rounded-[var(--radius-lg)] border border-[--borda] overflow-hidden transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
      style={{ borderLeftColor: acc.color, borderLeftWidth: '3px' }}
    >
      <div className="px-4 pt-3.5 pb-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: acc.bg }}
            >
              <Droplets size={14} style={{ color: acc.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg)' }}>
                {aplicacao.produto?.nome || 'Produto'}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--fg-subtle)' }}>
                {aplicacao.produto ? produtoTipoLabel(aplicacao.produto.tipo as any) : ''}
              </p>
            </div>
          </div>
          <StatusBadge status={aplicacao.status} />
        </div>

        {/* Talhao chip */}
        {showTalhao && aplicacao.talhao && (
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}>
              <span>{culturaIcon((aplicacao.talhao as any).cultura)}</span>
              <span className="font-medium" style={{ color: 'var(--fg-muted)' }}>
                {aplicacao.talhao.nome}
              </span>
              <span style={{ color: 'var(--borda)' }}>·</span>
              <span style={{ color: 'var(--fg-subtle)' }}>
                {culturaLabel((aplicacao.talhao as any).cultura)}
              </span>
            </div>
          </div>
        )}

        {/* Date row */}
        <div
          className="flex items-center gap-4 pt-3"
          style={{ borderTop: '1px solid var(--borda)' }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            <Calendar size={11} className="flex-shrink-0" />
            <span>
              <span style={{ color: 'var(--fg-muted)' }}>{formatDate(aplicacao.data_aplicacao)}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            <Calendar size={11} className="flex-shrink-0" />
            <span>
              Próxima{' '}
              <span
                className="font-semibold"
                style={{
                  color: aplicacao.status === 'atrasado' ? 'hsl(4 72% 50%)'
                    : aplicacao.status === 'hoje' ? 'hsl(210 100% 45%)'
                    : 'var(--fg-muted)',
                }}
              >
                {formatDate(aplicacao.proxima_aplicacao)}
              </span>
              {' '}
              <span style={{ color: 'var(--fg-subtle)' }}>
                ({dias === 0 ? 'hoje' : dias > 0 ? `em ${dias}d` : `${Math.abs(dias)}d atrás`})
              </span>
            </span>
          </div>
        </div>

        {/* Observação */}
        {aplicacao.observacoes && (
          <p
            className="mt-2.5 text-xs line-clamp-1 px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--borda)', color: 'var(--fg-subtle)' }}
          >
            {aplicacao.observacoes}
          </p>
        )}
      </div>
    </div>
  )
}
