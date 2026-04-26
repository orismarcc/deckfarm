'use client'
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Aplicacao, Produto } from '@/types'

interface ProductBarChartProps {
  aplicacoes: Aplicacao[]
  produtos: Produto[]
}

const COLORS = ['hsl(160 84% 22%)', 'hsl(160 60% 35%)', 'hsl(160 50% 45%)', 'hsl(160 40% 55%)', 'hsl(160 30% 65%)']

export function ProductBarChart({ aplicacoes, produtos }: ProductBarChartProps) {
  const data = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of aplicacoes) {
      counts.set(a.produto_id, (counts.get(a.produto_id) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        name: produtos.find(p => p.id === id)?.nome ?? id,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [aplicacoes, produtos])

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13, padding: '32px 0' }}>Sem dados no período</div>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} width={120} />
        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="count" name="Aplicações" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
