'use client'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  color?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function KpiCard({ label, value, sub, icon: Icon, color = 'hsl(160 84% 22%)', trend, trendValue }: KpiCardProps) {
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280'
  const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--borda)',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', lineHeight: 1.3 }}>{label}</div>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {sub && <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{sub}</span>}
          {trend && trendValue && (
            <span style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>
              {trendIcon} {trendValue}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
