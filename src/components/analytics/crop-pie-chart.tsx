'use client'
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Talhao, CulturaType } from '@/types'
import { culturaLabel } from '@/lib/utils'

const CROP_COLORS: Record<CulturaType, string> = {
  soja:          'hsl(160 84% 22%)',
  milho:         'hsl(38 90% 50%)',
  milho_safrinha:'hsl(38 70% 40%)',
  algodao:       'hsl(210 100% 60%)',
  feijao:        'hsl(280 70% 55%)',
  gergelim:      'hsl(0 72% 51%)',
}

interface CropPieChartProps {
  talhoes: Talhao[]
}

export function CropPieChart({ talhoes }: CropPieChartProps) {
  const data = useMemo(() => {
    const counts = new Map<CulturaType, number>()
    for (const t of talhoes) {
      counts.set(t.cultura, (counts.get(t.cultura) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([cultura, count]) => ({
      name: culturaLabel(cultura),
      value: count,
      color: CROP_COLORS[cultura] ?? '#6b7280',
    }))
  }, [talhoes])

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13, padding: '32px 0' }}>Sem talhões</div>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
