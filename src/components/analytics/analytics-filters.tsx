'use client'
import type { Fazenda, Talhao, CulturaType } from '@/types'
import { useAnalyticsStore, type PeriodFilter } from '@/store/analytics'
import { culturaLabel } from '@/lib/utils'

const CULTURAS: CulturaType[] = ['soja', 'milho', 'milho_safrinha', 'algodao', 'feijao', 'gergelim']
const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: '7d',    label: '7 dias' },
  { value: '30d',   label: '30 dias' },
  { value: '90d',   label: '90 dias' },
  { value: 'safra', label: 'Safra atual' },
  { value: 'custom',label: 'Personalizado' },
]

interface AnalyticsFiltersProps {
  fazendas: Fazenda[]
  talhoes: Talhao[]
}

export function AnalyticsFilters({ fazendas, talhoes }: AnalyticsFiltersProps) {
  const {
    fazendaId, talhaoId, cultura, period, customFrom, customTo,
    setFazendaId, setTalhaoId, setCultura, setPeriod, setCustomRange,
  } = useAnalyticsStore()

  const filteredTalhoes = fazendaId
    ? talhoes.filter(t => t.fazenda_id === fazendaId)
    : talhoes

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--borda)',
      padding: '10px 0 12px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    }}>
      {/* Fazenda */}
      <select
        value={fazendaId ?? ''}
        onChange={e => setFazendaId(e.target.value || null)}
        style={selectStyle}
      >
        <option value="">Todas as fazendas</option>
        {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>

      {/* Talhão */}
      <select
        value={talhaoId ?? ''}
        onChange={e => setTalhaoId(e.target.value || null)}
        style={selectStyle}
      >
        <option value="">Todos os talhões</option>
        {filteredTalhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      {/* Cultura */}
      <select
        value={cultura ?? ''}
        onChange={e => setCultura(e.target.value || null)}
        style={selectStyle}
      >
        <option value="">Todas as culturas</option>
        {CULTURAS.map(c => <option key={c} value={c}>{culturaLabel(c)}</option>)}
      </select>

      {/* Período */}
      <div style={{ display: 'flex', gap: 4 }}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: period === p.value ? '1.5px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
              background: period === p.value ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg)',
              color: period === p.value ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="date"
            value={customFrom ?? ''}
            onChange={e => setCustomRange(e.target.value, customTo ?? '')}
            style={{ ...selectStyle, width: 130 }}
          />
          <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>até</span>
          <input
            type="date"
            value={customTo ?? ''}
            onChange={e => setCustomRange(customFrom ?? '', e.target.value)}
            style={{ ...selectStyle, width: 130 }}
          />
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1.5px solid var(--borda)',
  background: 'var(--bg)',
  color: 'var(--fg)',
  fontSize: 12,
  fontWeight: 500,
}
