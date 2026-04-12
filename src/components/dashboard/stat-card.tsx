import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
  href?: string
  description?: string
}

export function StatCard({ label, value, icon: Icon, variant = 'default', description }: StatCardProps) {
  const colors = {
    default: { bg: 'bg-gray-50', icon: 'bg-gray-100 text-gray-600', text: 'text-gray-900' },
    danger: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', text: 'text-red-700' },
    warning: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', text: 'text-yellow-700' },
    success: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', text: 'text-green-700' },
    info: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-700' },
  }[variant]

  return (
    <div className={cn('rounded-xl p-4 flex items-center gap-4 border', colors.bg, variant === 'default' ? 'border-gray-200' : `border-${variant === 'danger' ? 'red' : variant === 'warning' ? 'yellow' : variant === 'success' ? 'green' : 'blue'}-100`)}>
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colors.icon)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className={cn('text-2xl font-bold', colors.text)}>{value}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  )
}
