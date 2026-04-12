import { cn } from '@/lib/utils'
import { statusLabel, statusColor } from '@/lib/utils'
import type { AplicacaoStatus } from '@/types'

interface StatusBadgeProps {
  status: AplicacaoStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusColor(status), className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', {
        'bg-green-500': status === 'dentro_do_prazo',
        'bg-yellow-500': status === 'proximo',
        'bg-blue-500': status === 'hoje',
        'bg-red-500': status === 'atrasado',
      })} />
      {statusLabel(status)}
    </span>
  )
}
