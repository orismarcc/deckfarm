import { cn, formatDate, culturaLabel, culturaIcon, produtoTipoLabel, diasParaProxima, produtoTipoColor } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Aplicacao } from '@/types'
import { Calendar, Droplets } from 'lucide-react'

interface AplicacaoCardProps {
  aplicacao: Aplicacao
  showTalhao?: boolean
}

const accentColor: Record<string, string> = {
  atrasado:       '#ef4444',
  hoje:           '#3b82f6',
  proximo:        '#f59e0b',
  dentro_do_prazo:'#22c55e',
}

export function AplicacaoCard({ aplicacao, showTalhao = true }: AplicacaoCardProps) {
  const dias = diasParaProxima(aplicacao.proxima_aplicacao)
  const accent = accentColor[aplicacao.status] || '#22c55e'

  return (
    <div
      className="bg-[--bg-card] rounded-2xl border border-[--borda] overflow-hidden transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      <div className="px-4 pt-3.5 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex-1 min-w-0">
            {showTalhao && aplicacao.talhao && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{culturaIcon((aplicacao.talhao as any).cultura)}</span>
                <span className="text-xs font-semibold text-[--fg-muted] truncate">
                  {aplicacao.talhao.nome}
                </span>
                <span className="text-[--borda]">·</span>
                <span className="text-xs text-[--fg-subtle] truncate">
                  {culturaLabel((aplicacao.talhao as any).cultura)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}18` }}
              >
                <Droplets className="w-3.5 h-3.5" style={{ color: accent }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-[--fg] leading-tight">
                  {aplicacao.produto?.nome || 'Produto'}
                </div>
                {aplicacao.produto && (
                  <div className="text-[11px] text-[--fg-subtle]">
                    {produtoTipoLabel(aplicacao.produto.tipo as any)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={aplicacao.status} />
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 pt-2.5 border-t border-[--borda]">
          <div className="flex items-center gap-1.5 text-xs text-[--fg-subtle]">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Aplicado{' '}
              <span className="font-medium text-[--fg-muted]">
                {formatDate(aplicacao.data_aplicacao)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[--fg-subtle]">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Próxima{' '}
              <span className={cn(
                'font-medium',
                aplicacao.status === 'atrasado' ? 'text-red-600'
                : aplicacao.status === 'hoje'   ? 'text-blue-600'
                :                                  'text-[--fg-muted]'
              )}>
                {formatDate(aplicacao.proxima_aplicacao)}
              </span>
              {' '}
              <span className="text-[--fg-subtle]">
                ({dias === 0 ? 'hoje' : dias > 0 ? `em ${dias}d` : `${Math.abs(dias)}d atrás`})
              </span>
            </span>
          </div>
        </div>

        {/* Observações */}
        {aplicacao.observacoes && (
          <p className="mt-2 text-xs text-[--fg-subtle] bg-[--bg] rounded-lg px-2.5 py-1.5 line-clamp-1 border border-[--borda]">
            {aplicacao.observacoes}
          </p>
        )}
      </div>
    </div>
  )
}
