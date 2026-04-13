import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
  description?: string
}

const variants = {
  default: { color: 'hsl(215 16% 40%)',   bg: 'hsl(215 16% 94%)',    accent: 'hsl(215 16% 70%)' },
  danger:  { color: 'hsl(4 72% 50%)',     bg: 'hsl(4 86% 96%)',      accent: 'hsl(4 72% 50%)' },
  warning: { color: 'hsl(38 70% 38%)',    bg: 'hsl(38 92% 95%)',     accent: 'hsl(38 92% 46%)' },
  success: { color: 'hsl(160 84% 22%)',   bg: 'hsl(160 84% 96%)',    accent: 'hsl(160 84% 22%)' },
  info:    { color: 'hsl(210 100% 45%)',  bg: 'hsl(210 100% 96%)',   accent: 'hsl(210 100% 45%)' },
}

export function StatCard({ label, value, icon: Icon, variant = 'default', description }: StatCardProps) {
  const v = variants[variant]
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: v.bg }}
        >
          <Icon size={15} style={{ color: v.color }} />
        </div>
        <span className="text-[1.875rem] font-bold leading-none tabular-nums" style={{ color: 'var(--fg)' }}>
          {value}
        </span>
      </div>
      <div>
        <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--fg-muted)' }}>{label}</p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{description}</p>
        )}
      </div>
      <div className="h-[3px] rounded-full" style={{ background: v.accent, opacity: 0.28 }} />
    </div>
  )
}
