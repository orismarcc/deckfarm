import { create } from 'zustand'
import { format, subDays, startOfYear } from 'date-fns'

export type PeriodFilter = '7d' | '30d' | '90d' | 'safra' | 'custom'

export interface AnalyticsFilters {
  fazendaId: string | null
  talhaoId: string | null
  cultura: string | null
  period: PeriodFilter
  customFrom: string | null
  customTo: string | null
}

interface AnalyticsState extends AnalyticsFilters {
  setFazendaId: (id: string | null) => void
  setTalhaoId: (id: string | null) => void
  setCultura: (c: string | null) => void
  setPeriod: (p: PeriodFilter) => void
  setCustomRange: (from: string, to: string) => void
  reset: () => void
}

const initialFilters: AnalyticsFilters = {
  fazendaId: null,
  talhaoId: null,
  cultura: null,
  period: '30d',
  customFrom: null,
  customTo: null,
}

export const useAnalyticsStore = create<AnalyticsState>()((set) => ({
  ...initialFilters,
  setFazendaId: (fazendaId) => set({ fazendaId, talhaoId: null }),
  setTalhaoId:  (talhaoId)  => set({ talhaoId }),
  setCultura:   (cultura)   => set({ cultura }),
  setPeriod:    (period)    => set({ period }),
  setCustomRange: (customFrom, customTo) => set({ period: 'custom', customFrom, customTo }),
  reset: () => set(initialFilters),
}))

/** Convert a PeriodFilter to { from, to } ISO date strings. */
export function resolvePeriodDates(period: PeriodFilter, customFrom?: string | null, customTo?: string | null): { from: string; to: string } {
  const today = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  switch (period) {
    case '7d':    return { from: fmt(subDays(today, 7)),   to: fmt(today) }
    case '30d':   return { from: fmt(subDays(today, 30)),  to: fmt(today) }
    case '90d':   return { from: fmt(subDays(today, 90)),  to: fmt(today) }
    case 'safra': return { from: fmt(startOfYear(today)),  to: fmt(today) }
    case 'custom':
      return {
        from: customFrom ?? fmt(subDays(today, 30)),
        to:   customTo   ?? fmt(today),
      }
    default:      return { from: fmt(subDays(today, 30)),  to: fmt(today) }
  }
}
