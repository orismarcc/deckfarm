import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
  description?: string
}

const styles = {
  default: {
    wrap:  'bg-[--bg-card] border-[--borda]',
    icon:  'bg-[--bg-dark] text-[--fg-muted]',
    value: 'text-[--fg]',
  },
  danger: {
    wrap:  'bg-red-50 border-red-100',
    icon:  'bg-red-100 text-red-600',
    value: 'text-red-700',
  },
  warning: {
    wrap:  'bg-[hsl(43_90%_96%)] border-amber-100',
    icon:  'bg-amber-100 text-amber-600',
    value: 'text-amber-700',
  },
  success: {
    wrap:  'bg-[hsl(142_60%_96%)] border-emerald-100',
    icon:  'bg-emerald-100 text-emerald-600',
    value: 'text-emerald-700',
  },
  info: {
    wrap:  'bg-blue-50 border-blue-100',
    icon:  'bg-blue-100 text-blue-600',
    value: 'text-blue-700',
  },
}

export function StatCard({ label, value, icon: Icon, variant = 'default', description }: StatCardProps) {
  const s = styles[variant]
  return (
    <div className={cn(
      'rounded-2xl p-4 border flex items-center gap-3 transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5',
      s.wrap
    )}>
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', s.icon)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="section-label truncate">{label}</div>
        <div className={cn('text-2xl font-bold leading-tight mt-0.5 tabular-nums', s.value)}>
          {value}
        </div>
        {description && (
          <div className="text-xs text-[--fg-subtle] mt-0.5 truncate">{description}</div>
        )}
      </div>
    </div>
  )
}
