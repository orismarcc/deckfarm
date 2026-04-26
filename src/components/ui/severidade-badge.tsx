import type { SeveridadeMonitoramento } from '@/types'

export const SEVERIDADE_ORDER: SeveridadeMonitoramento[] = ['nenhum', 'leve', 'moderado', 'severo', 'critico']

const SEVERIDADE_CONFIG: Record<SeveridadeMonitoramento, { label: string; color: string; bg: string; dot: string }> = {
  nenhum:   { label: 'Nenhum',   color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  leve:     { label: 'Leve',     color: '#166534', bg: '#dcfce7', dot: '#22c55e' },
  moderado: { label: 'Moderado', color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  severo:   { label: 'Severo',   color: '#9a3412', bg: '#ffedd5', dot: '#f97316' },
  critico:  { label: 'Crítico',  color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
}

export function worstSeveridade(severidades: SeveridadeMonitoramento[]): SeveridadeMonitoramento {
  if (!severidades.length) return 'nenhum'
  return severidades.reduce((worst, s) => {
    return SEVERIDADE_ORDER.indexOf(s) > SEVERIDADE_ORDER.indexOf(worst) ? s : worst
  }, 'nenhum' as SeveridadeMonitoramento)
}

export function severidadeColor(sev: SeveridadeMonitoramento): string {
  if (sev === 'nenhum' || sev === 'leve') return '#22c55e'
  if (sev === 'moderado') return '#f59e0b'
  return '#ef4444'
}

interface SeveridadeBadgeProps {
  severidade: SeveridadeMonitoramento
  size?: 'sm' | 'md'
}

export function SeveridadeBadge({ severidade, size = 'md' }: SeveridadeBadgeProps) {
  const cfg = SEVERIDADE_CONFIG[severidade]
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const fs  = size === 'sm' ? 11 : 12

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: pad,
      borderRadius: 99,
      background: cfg.bg,
      color: cfg.color,
      fontSize: fs,
      fontWeight: 600,
      lineHeight: 1.4,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

/** Header status dot for talhão — verde/amarelo/vermelho */
export function SeveridadeDot({ severidade }: { severidade: SeveridadeMonitoramento }) {
  const color = severidadeColor(severidade)
  const labels: Record<SeveridadeMonitoramento, string> = {
    nenhum: '🟢', leve: '🟢', moderado: '🟡', severo: '🔴', critico: '🔴',
  }
  return (
    <span title={SEVERIDADE_CONFIG[severidade].label} style={{ fontSize: 12 }}>
      {labels[severidade]}
    </span>
  )
}
