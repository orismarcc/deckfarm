'use client'
import { useMemo, useState } from 'react'
import { subDays, parseISO, isAfter } from 'date-fns'
import type { MonitoramentoPraga, SeveridadeMonitoramento, CulturaType } from '@/types'
import { MonitoramentoCard } from './monitoramento-card'

type TipoFilter    = 'todos' | 'praga' | 'doenca'
type PeriodoFilter = '7d' | '30d' | '90d' | 'tudo'

interface MonitoramentoTimelineProps {
  registros: MonitoramentoPraga[]
  cultura: CulturaType
  onEdit: (r: MonitoramentoPraga) => void
  onDelete: (id: string) => void
}

export function MonitoramentoTimeline({ registros, cultura, onEdit, onDelete }: MonitoramentoTimelineProps) {
  const [tipo,       setTipo]       = useState<TipoFilter>('todos')
  const [periodo,    setPeriodo]    = useState<PeriodoFilter>('30d')
  const [severidades, setSeveridades] = useState<Set<SeveridadeMonitoramento>>(new Set())

  const filtered = useMemo(() => {
    const now = new Date()
    const cutoff: Record<PeriodoFilter, Date | null> = {
      '7d':  subDays(now, 7),
      '30d': subDays(now, 30),
      '90d': subDays(now, 90),
      'tudo': null,
    }
    const cut = cutoff[periodo]

    return registros
      .filter(r => {
        if (tipo !== 'todos' && r.tipo !== tipo) return false
        if (severidades.size > 0 && !severidades.has(r.severidade)) return false
        if (cut) {
          try { if (!isAfter(parseISO(r.data), cut)) return false }
          catch { return false }
        }
        return true
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [registros, tipo, periodo, severidades])

  function toggleSeveridade(s: SeveridadeMonitoramento) {
    setSeveridades(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  const allSeveridades: SeveridadeMonitoramento[] = ['nenhum', 'leve', 'moderado', 'severo', 'critico']
  const sevLabels: Record<SeveridadeMonitoramento, string> = {
    nenhum: 'Nenhum', leve: 'Leve', moderado: 'Moderado', severo: 'Severo', critico: 'Crítico',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Tipo + Período */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Tipo */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['todos', 'praga', 'doenca'] as TipoFilter[]).map(t => (
              <button key={t} onClick={() => setTipo(t)} style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: tipo === t ? '1.5px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
                background: tipo === t ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg)',
                color: tipo === t ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
              }}>
                {t === 'todos' ? 'Todos' : t === 'praga' ? 'Pragas' : 'Doenças'}
              </button>
            ))}
          </div>
          {/* Período */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {(['7d', '30d', '90d', 'tudo'] as PeriodoFilter[]).map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: periodo === p ? '1.5px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
                background: periodo === p ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg)',
                color: periodo === p ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
              }}>
                {p === 'tudo' ? 'Tudo' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Severidade checkboxes */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-subtle)', marginRight: 4 }}>Severidade:</span>
          {allSeveridades.map(s => (
            <button key={s} onClick={() => toggleSeveridade(s)} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: severidades.has(s) ? '1.5px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
              background: severidades.has(s) ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg)',
              color: severidades.has(s) ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
            }}>
              {sevLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
          Nenhum registro encontrado
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <MonitoramentoCard
              key={r.id}
              registro={r}
              cultura={cultura}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
