import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'amber'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-wide',
      {
        'bg-[--bg-dark] text-[--fg-muted] border-[--borda]': variant === 'default',
        'bg-[hsl(142_60%_93%)] text-[hsl(142_72%_25%)] border-[hsl(142_72%_30%/0.25)]': variant === 'success',
        'bg-[hsl(43_90%_93%)] text-[hsl(38_70%_32%)] border-[hsl(38_92%_46%/0.30)]': variant === 'warning',
        'bg-red-50 text-red-700 border-red-200': variant === 'danger',
        'bg-blue-50 text-blue-700 border-blue-200': variant === 'info',
        'bg-[--ambar-100] text-[--ambar-600] border-[--ambar-600]/30': variant === 'amber',
      },
      className
    )}>
      {children}
    </span>
  )
}
