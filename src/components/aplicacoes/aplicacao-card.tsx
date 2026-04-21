'use client'
import { useState } from 'react'
import { cn, formatDate, culturaLabel, culturaIcon, produtoTipoLabel, diasParaProxima } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Aplicacao } from '@/types'
import { Calendar, Droplets, MapPin, FlaskConical, Package, Ruler, Trash2 } from 'lucide-react'

interface AplicacaoCardProps {
  aplicacao: Aplicacao
  showTalhao?: boolean
  onDelete?: () => void
}

const accentMap: Record<string, { color: string; bg: string }> = {
  atrasado:        { color: 'hsl(4 72% 50%)',    bg: 'hsl(4 86% 96%)' },
  hoje:            { color: 'hsl(210 100% 45%)',  bg: 'hsl(210 100% 96%)' },
  proximo:         { color: 'hsl(38 70% 38%)',    bg: 'hsl(38 92% 95%)' },
  dentro_do_prazo: { color: 'hsl(160 84% 22%)',   bg: 'hsl(160 84% 96%)' },
}

export function AplicacaoCard({ aplicacao, showTalhao = true, onDelete }: AplicacaoCardProps) {
  const [confirming, setConfirming] = useState(false)
  const dias = diasParaProxima(aplicacao.proxima_aplicacao)
  const acc = accentMap[aplicacao.status] || accentMap.dentro_do_prazo

  const produto = aplicacao.produto as any
  const talhao  = aplicacao.talhao  as any

  // Computed usage — dose × area
  const areaUsada = aplicacao.area_aplicada ?? talhao?.area
  const qtdUsada = (aplicacao.dose && areaUsada)
    ? Number((aplicacao.dose * areaUsada).toFixed(2))
    : null
  const unidade = aplicacao.unidade_dose?.split('/')[0] ?? ''   // "L/ha" → "L"
  const estoqueAtual = produto?.quantidade_disponivel
  const unidadeEstoque = produto?.unidade_quantidade ?? unidade

  // Is realizada (done)
  const realizada = aplicacao.tipo === 'realizada'

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
                {produto?.nome || 'Produto'}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--fg-subtle)' }}>
                {produto ? produtoTipoLabel(produto.tipo) : ''}
                {realizada && (
                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'hsl(160 84% 22% / 0.1)', color: 'hsl(160 84% 22%)' }}>
                    ✓ Realizada
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatusBadge status={aplicacao.status} />
            {onDelete && (
              confirming ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setConfirming(false); onDelete() }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'hsl(4 72% 50%)', color: 'white' }}
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'var(--bg-dark)', color: 'var(--fg-muted)' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--fg-subtle)' }}
                  title="Remover aplicação"
                  onMouseEnter={e => { e.currentTarget.style.background = 'hsl(4 86% 96%)'; e.currentTarget.style.color = 'hsl(4 72% 45%)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}
                >
                  <Trash2 size={13} />
                </button>
              )
            )}
          </div>
        </div>

        {/* Talhão chip */}
        {showTalhao && talhao && (
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}>
              <span>{culturaIcon(talhao.cultura)}</span>
              <span className="font-medium" style={{ color: 'var(--fg-muted)' }}>
                {talhao.nome}
              </span>
              <span style={{ color: 'var(--borda)' }}>·</span>
              <span style={{ color: 'var(--fg-subtle)' }}>
                {culturaLabel(talhao.cultura)}
              </span>
            </div>
          </div>
        )}

        {/* Application details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
          {aplicacao.dose != null && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
              <FlaskConical size={10} className="flex-shrink-0" />
              <span>Dose: <span className="font-semibold" style={{ color: 'var(--fg-muted)' }}>
                {aplicacao.dose} {aplicacao.unidade_dose}
              </span></span>
            </div>
          )}
          {areaUsada != null && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
              <Ruler size={10} className="flex-shrink-0" />
              <span>Área: <span className="font-semibold" style={{ color: 'var(--fg-muted)' }}>
                {areaUsada} ha
              </span></span>
            </div>
          )}
          {qtdUsada != null && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
              <Droplets size={10} className="flex-shrink-0" />
              <span>Usado: <span className="font-semibold" style={{ color: 'var(--fg-muted)' }}>
                {qtdUsada} {unidade}
              </span></span>
            </div>
          )}
          {estoqueAtual != null && realizada && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
              <Package size={10} className="flex-shrink-0" />
              <span>Estoque: <span className="font-semibold" style={{
                color: estoqueAtual < 10 ? 'hsl(4 72% 50%)' : 'var(--fg-muted)',
              }}>
                {estoqueAtual} {unidadeEstoque}
              </span></span>
            </div>
          )}
        </div>

        {/* Date row */}
        <div
          className="flex items-center gap-4 pt-3"
          style={{ borderTop: '1px solid var(--borda)' }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            <Calendar size={11} className="flex-shrink-0" />
            <span>
              {realizada ? 'Realizada em ' : 'Agendada: '}
              <span style={{ color: 'var(--fg-muted)' }}>{formatDate(aplicacao.data_aplicacao)}</span>
            </span>
          </div>
          {aplicacao.proxima_aplicacao && (
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
          )}
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
