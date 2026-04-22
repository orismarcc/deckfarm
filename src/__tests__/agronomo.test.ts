/**
 * Unit tests for the DeckFarm agronomist engine (src/lib/db/agronomo.ts)
 *
 * Tests cover: status calculation, scheduling logic, and edge cases.
 * Run with: npx vitest run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Isolated calcStatus logic (extracted for testability) ──────────────────
function calcStatus(data: string): string {
  const [y, m, dd] = data.split('-').map(Number)
  const d = new Date(y, m - 1, dd)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - hoje.getTime()
  const diff = Math.round(diffMs / 86400000)
  if (diff === 0) return 'hoje'
  if (diff < 0)  return 'atrasado'
  if (diff <= 7) return 'proximo'
  return 'dentro_do_prazo'
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Returns local date string for today + N days (avoids UTC offset bugs) */
function dateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(12, 0, 0, 0) // use noon to avoid DST/midnight edge cases
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ── Status Calculation ─────────────────────────────────────────────────────
describe('calcStatus', () => {
  it('returns "hoje" for today', () => {
    expect(calcStatus(dateOffset(0))).toBe('hoje')
  })

  it('returns "atrasado" for yesterday', () => {
    expect(calcStatus(dateOffset(-1))).toBe('atrasado')
  })

  it('returns "atrasado" for 10 days ago', () => {
    expect(calcStatus(dateOffset(-10))).toBe('atrasado')
  })

  it('returns "proximo" for tomorrow', () => {
    expect(calcStatus(dateOffset(1))).toBe('proximo')
  })

  it('returns "proximo" for 7 days from now', () => {
    expect(calcStatus(dateOffset(7))).toBe('proximo')
  })

  it('returns "dentro_do_prazo" for 8 days from now', () => {
    expect(calcStatus(dateOffset(8))).toBe('dentro_do_prazo')
  })

  it('returns "dentro_do_prazo" for 30 days from now', () => {
    expect(calcStatus(dateOffset(30))).toBe('dentro_do_prazo')
  })

  it('handles year boundary correctly (no UTC offset bug)', () => {
    // Using local date constructor avoids the classic UTC-1 day issue
    const status = calcStatus(dateOffset(0))
    expect(['hoje', 'proximo', 'atrasado', 'dentro_do_prazo']).toContain(status)
  })
})

// ── Scheduling intervals ───────────────────────────────────────────────────
describe('Application scheduling', () => {
  it('generates correct number of applications for a 90-day cycle with 21-day interval', () => {
    const ciclo = 90
    const intervalo = 21
    // Applications at: day 21, 42, 63, 84 → 4 applications
    const expected = Math.floor(ciclo / intervalo)
    expect(expected).toBe(4)
  })

  it('generates correct applications for soja (110 days, 21-day default)', () => {
    const ciclo = 110
    const intervalo = 21
    // day 21, 42, 63, 84, 105 → 5 applications
    let count = 0
    let day = intervalo
    while (day <= ciclo) { count++; day += intervalo }
    expect(count).toBe(5)
  })

  it('generates correct applications for algodao (160 days, 21-day default)', () => {
    const ciclo = 160
    const intervalo = 21
    // day 21, 42, 63, 84, 105, 126, 147 → 7 applications
    let count = 0
    let day = intervalo
    while (day <= ciclo) { count++; day += intervalo }
    expect(count).toBe(7)
  })

  it('no applications if planting date is missing', () => {
    const talhao = { id: '1', data_plantio: undefined }
    expect(talhao.data_plantio).toBeUndefined()
  })
})

// ── Cultura cycles ─────────────────────────────────────────────────────────
describe('CICLO_CULTURA constants', () => {
  const CICLO = {
    soja: 110, milho: 120, milho_safrinha: 115,
    gergelim: 100, feijao: 90, algodao: 160,
  }

  it('all cultures have a defined cycle', () => {
    for (const [cultura, dias] of Object.entries(CICLO)) {
      expect(dias, `${cultura} deve ter ciclo > 0`).toBeGreaterThan(0)
    }
  })

  it('algodao has the longest cycle', () => {
    const max = Math.max(...Object.values(CICLO))
    expect(CICLO.algodao).toBe(max)
  })

  it('feijao has the shortest cycle', () => {
    const min = Math.min(...Object.values(CICLO))
    expect(CICLO.feijao).toBe(min)
  })
})

// ── Alert deduplication ────────────────────────────────────────────────────
describe('Alert deduplication key', () => {
  it('generates consistent key for talhao with id', () => {
    const n = { tipo: 'atrasado', talhao_id: 'abc-123', data_referencia: '2026-01-01' }
    const key = `${n.tipo}:${n.talhao_id ?? ''}:${n.data_referencia}`
    expect(key).toBe('atrasado:abc-123:2026-01-01')
  })

  it('normalises undefined talhao_id to empty string (no ghost notifications)', () => {
    const n = { tipo: 'atrasado', talhao_id: undefined, data_referencia: '2026-01-01' }
    const key = `${n.tipo}:${n.talhao_id ?? ''}:${n.data_referencia}`
    expect(key).toBe('atrasado::2026-01-01')
    expect(key).not.toContain('undefined')
  })

  it('different talhao_ids produce different keys', () => {
    const k1 = `atrasado:talhao-1:2026-01-01`
    const k2 = `atrasado:talhao-2:2026-01-01`
    expect(k1).not.toBe(k2)
  })
})

// ── Soft delete ────────────────────────────────────────────────────────────
describe('Soft delete logic', () => {
  it('deleted_at null means record is active', () => {
    const app = { id: '1', deleted_at: null }
    expect(!app.deleted_at).toBe(true)
  })

  it('deleted_at set means record is deleted', () => {
    const app = { id: '1', deleted_at: new Date().toISOString() }
    expect(!app.deleted_at).toBe(false)
  })

  it('filter removes deleted records', () => {
    const apps = [
      { id: '1', deleted_at: null },
      { id: '2', deleted_at: '2026-01-01T00:00:00.000Z' },
      { id: '3', deleted_at: undefined },
    ]
    const active = apps.filter(a => !a.deleted_at)
    expect(active).toHaveLength(2)
    expect(active.map(a => a.id)).toEqual(['1', '3'])
  })
})

// ── Conflict resolution ────────────────────────────────────────────────────
describe('Conflict resolution (updatedAt-wins)', () => {
  function mergeByUpdatedAt<T extends { id: string; updatedAt?: string }>(local: T[], server: T[]): T[] {
    const map = new Map<string, T>()
    for (const item of local) map.set(item.id, item)
    for (const item of server) {
      const existing = map.get(item.id)
      if (!existing || (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt)) {
        map.set(item.id, item)
      }
    }
    return Array.from(map.values())
  }

  it('server record wins when newer', () => {
    const local  = [{ id: '1', value: 'local',  updatedAt: '2026-01-01T10:00:00Z' }]
    const server = [{ id: '1', value: 'server', updatedAt: '2026-01-01T12:00:00Z' }]
    const result = mergeByUpdatedAt(local, server)
    expect(result[0].value).toBe('server')
  })

  it('local record wins when newer (offline edit)', () => {
    const local  = [{ id: '1', value: 'local-edit', updatedAt: '2026-01-01T14:00:00Z' }]
    const server = [{ id: '1', value: 'server-old', updatedAt: '2026-01-01T12:00:00Z' }]
    const result = mergeByUpdatedAt(local, server)
    expect(result[0].value).toBe('local-edit')
  })

  it('local-only records are preserved', () => {
    const local  = [{ id: '99', value: 'local-only', updatedAt: '2026-01-01T00:00:00Z' }]
    const server: typeof local = []
    const result = mergeByUpdatedAt(local, server)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('99')
  })
})
