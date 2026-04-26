'use client'
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Aplicacao, Produto, ProdutoTipo } from '@/types'

const TYPE_COLORS: Record<ProdutoTipo, string> = {
  herbicida:   'hsl(160 84% 22%)',
  fungicida:   'hsl(210 100% 50%)',
  inseticida:  'hsl(38 90% 50%)',
  fertilizante:'hsl(280 70% 55%)',
  defensivo:   'hsl(0 72% 51%)',
}

const TYPE_LABELS: Record<ProdutoTipo, string> = {
  herbicida:   'Herbicida',
  fungicida:   'Fungicida',
  inseticida:  'Inseticida',
  fertilizante:'Fertilizante',
  defensivo:   'Defensivo',
}

interface TypePieChartProps {
  aplicacoes: Aplicacao[]
  produtos: Produto[]
}

export function TypePieChart({ aplicacoes, produtos }: TypePieChartProps) {
  const data = useMemo(() => {
    const prodMap = new Map(produtos.map(p => [p.id, p]))
    const counts = new Map<ProdutoTipo, number>()
    for (const a of aplicacoes) {
      const tipo = prodMap.get(a.produto_id)?.tipo
      if (tipo) counts.set(tipo, (counts.get(tipo) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([tipo, count]) => ({
      name: TYPE_LABELS[tipo] ?? tipo,
      value: count,
      color: TYPE_COLORS[tipo] ?? '#6b7280',
    }))
  }, [aplicacoes, produtos])

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13, padding: '32px 0' }}>Sem dados no período</div>
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
