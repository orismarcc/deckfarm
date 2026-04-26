'use client'
import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, parseISO, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Aplicacao } from '@/types'

interface TrendLineChartProps {
  aplicacoes: Aplicacao[]
  from: string
  to: string
}

export function TrendLineChart({ aplicacoes, from, to }: TrendLineChartProps) {
  const data = useMemo(() => {
    if (!from || !to) return []
    try {
      const start = parseISO(from)
      const end   = parseISO(to)
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000)
      const useWeeks = diffDays <= 60

      const buckets = useWeeks
        ? eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => ({
            key: format(d, 'yyyy-WW'),
            label: format(d, 'dd/MM', { locale: ptBR }),
            start: startOfWeek(d, { weekStartsOn: 1 }),
          }))
        : eachMonthOfInterval({ start, end }).map(d => ({
            key: format(d, 'yyyy-MM'),
            label: format(d, 'MMM/yy', { locale: ptBR }),
            start: startOfMonth(d),
          }))

      return buckets.map(b => {
        const realizadas = aplicacoes.filter(a => {
          const d = a.data_aplicacao?.slice(0, 10)
          return d >= from && d <= to && a.tipo === 'realizada' && d.startsWith(b.key.replace('-WW', ''))
        })
        const planejadas = aplicacoes.filter(a => {
          const d = a.data_aplicacao?.slice(0, 10)
          return d >= from && d <= to && a.tipo !== 'realizada' && d.startsWith(b.key.replace('-WW', ''))
        })
        return { name: b.label, realizadas: realizadas.length, planejadas: planejadas.length }
      })
    } catch {
      return []
    }
  }, [aplicacoes, from, to])

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13, padding: '32px 0' }}>Sem dados no período</div>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} allowDecimals={false} />
        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="realizadas" name="Realizadas" stroke="hsl(160 84% 22%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="planejadas"  name="Planejadas"  stroke="hsl(210 100% 50%)" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
