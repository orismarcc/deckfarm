import { cn } from '@/lib/utils'
import type { AplicacaoStatus } from '@/types'

const config: Record<AplicacaoStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  dentro_do_prazo: { bg: 'bg-[hsl(142_60%_93%)]', text: 'text-[hsl(142_72%_25%)]', border: 'border-[hsl(142_72%_30%/0.25)]', dot: 'bg-[hsl(142_72%_35%)]', label: 'No prazo' },
  proximo:         { bg: 'bg-[hsl(43_90%_93%)]',  text: 'text-[hsl(38_70%_32%)]',  border: 'border-[hsl(38_92%_46%/0.30)]',  dot: 'bg-amber-500',              label: 'Próximo' },
  hoje:            { bg: 'bg-blue-50',              text: 'text-blue-700',            border: 'border-blue-200',                 dot: 'bg-blue-500',               label: 'Hoje' },
  atrasado:        { bg: 'bg-red-50',               text: 'text-red-700',             border: 'border-red-200',                  dot: 'bg-red-500',                label: 'Atrasado' },
}

export function StatusBadge({ status, className }: { status: AplicacaoStatus; className?: string }) {
  const c = config[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', c.bg, c.text, c.border, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />
      {c.label}
    </span>
  )
}
