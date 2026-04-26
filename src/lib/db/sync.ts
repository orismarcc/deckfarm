import { getDB } from './index'
import type { SyncQueueItem, Fazenda, Talhao, Produto, Aplicacao, SemeaduraEtapa, MonitoramentoPraga } from '@/types'
import { useAppStore } from '@/store/app'
import { v4 as uuidv4 } from 'uuid'

// ── Pull: fetch all user data from Supabase → upsert into local Dexie ─────────
// Called on app startup so every device always has the latest server state.
// Updates Zustand store directly after writing to Dexie, so ALL subscribed pages
// see fresh data immediately without waiting for the layout to re-read Dexie.

/** Strip Supabase join artifacts (nested objects) from a record before Dexie upsert */
function stripJoins(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    // Skip nested objects from Supabase JOIN selects (e.g. fazendas{}, talhoes{})
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) continue
    out[k] = v
  }
  return out
}

async function fetchEntity<T>(url: string, token: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[pullFromServer] ${url} → ${res.status}`)
      return []
    }
    const json = await res.json()
    const rows: unknown = json?.[key]
    if (!Array.isArray(rows)) {
      console.warn(`[pullFromServer] ${url} → key "${key}" not an array`, json)
      return []
    }
    return rows as T[]
  } catch (err) {
    console.error(`[pullFromServer] ${url} fetch error`, err)
    return []
  }
}

export async function pullFromServer(token: string): Promise<void> {
  if (!token) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const db = getDB()

  const [fazendas, talhoes, produtos, aplicacoes, etapas, monitoramentos] = await Promise.all([
    fetchEntity<Record<string, unknown>>('/api/fazendas',           token, 'fazendas'),
    fetchEntity<Record<string, unknown>>('/api/talhoes',            token, 'talhoes'),
    fetchEntity<Record<string, unknown>>('/api/produtos',           token, 'produtos'),
    fetchEntity<Record<string, unknown>>('/api/aplicacoes',         token, 'aplicacoes'),
    fetchEntity<Record<string, unknown>>('/api/semeadura-etapas',   token, 'semeadura_etapas'),
    fetchEntity<Record<string, unknown>>('/api/monitoramentos',     token, 'monitoramentos'),
  ])

  // Write to Dexie (idempotent — safe to run on every startup)
  const cleanFazendas        = fazendas.map(stripJoins)       as unknown as Fazenda[]
  const cleanTalhoes         = talhoes.map(stripJoins)        as unknown as Talhao[]
  const cleanProdutos        = produtos.map(stripJoins)       as unknown as Produto[]
  const cleanAplicacoes      = aplicacoes.map(stripJoins)     as unknown as Aplicacao[]
  const cleanEtapas          = etapas.map(stripJoins)         as unknown as SemeaduraEtapa[]
  const cleanMonitoramentos  = monitoramentos.map(stripJoins) as unknown as MonitoramentoPraga[]

  // Filter out soft-deleted aplicações coming from server
  const activeAplicacoes = cleanAplicacoes.filter(a => !(a as unknown as Record<string,unknown>).deleted_at)

  if (cleanFazendas.length)    await db.fazendas.bulkPut(cleanFazendas)
  if (cleanTalhoes.length)     await db.talhoes.bulkPut(cleanTalhoes)
  if (cleanProdutos.length)    await db.produtos.bulkPut(cleanProdutos)
  if (activeAplicacoes.length) await db.aplicacoes.bulkPut(activeAplicacoes)
  // Also hard-remove any locally-cached soft-deleted records
  const deletedIds = cleanAplicacoes
    .filter(a => (a as unknown as Record<string,unknown>).deleted_at)
    .map(a => a.id)
  if (deletedIds.length) await db.aplicacoes.bulkDelete(deletedIds)
  if (cleanEtapas.length)          await db.semeaduraEtapas.bulkPut(cleanEtapas)
  if (cleanMonitoramentos.length)  await db.monitoramentos.bulkPut(cleanMonitoramentos)

  // ── Update Zustand directly so all subscribed pages re-render immediately ──
  const store = useAppStore.getState()

  // Conflict resolution: updatedAt-wins — more recent record is kept.
  // Prevents offline edits from being silently discarded when server lags behind.
  if (cleanFazendas.length || cleanTalhoes.length || cleanProdutos.length || activeAplicacoes.length) {
    const mergedFazendas   = mergeByUpdatedAt(store.fazendas,   cleanFazendas)
    const mergedTalhoes    = mergeByUpdatedAt(store.talhoes,    cleanTalhoes)
    const mergedProdutos   = mergeByUpdatedAt(store.produtos,   cleanProdutos)
    const mergedAplicacoes = mergeByUpdatedAt(store.aplicacoes, activeAplicacoes)
      .filter(a => !(a as unknown as Record<string,unknown>).deleted_at)

    store.setFazendas(mergedFazendas)
    store.setTalhoes(mergedTalhoes)
    store.setProdutos(mergedProdutos)
    store.setAplicacoes(mergedAplicacoes)
  }

  // Signal pull completion — pages subscribed to lastServerSyncAt will re-run loadData()
  store.setLastServerSyncAt(Date.now())
}

/**
 * Merge two arrays by id using updatedAt conflict resolution.
 * The record with the most recent updatedAt wins; local-only records are kept.
 */
function mergeByUpdatedAt<T extends { id: string; updatedAt?: string }>(local: T[], server: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)
  for (const item of server) {
    const existing = map.get(item.id)
    // Server wins if no local record, or if server record is newer
    if (!existing || (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt)) {
      map.set(item.id, item)
    }
  }
  return Array.from(map.values())
}

export async function enqueueSync(
  entity: SyncQueueItem['entity'],
  action: SyncQueueItem['action'],
  data: Record<string, unknown>
): Promise<void> {
  const db = getDB()
  await db.syncQueue.add({
    id: uuidv4(),
    entity,
    action,
    data,
    timestamp: new Date().toISOString(),
    retries: 0,
  })
}

/**
 * Mapeamento explícito de entity name (syncQueue) → nome da tabela Dexie (camelCase).
 * IMPORTANTE: não usar lógica genérica de concatenar 's' — nomes snake_case/camelCase diferem.
 */
const ENTITY_TO_DEXIE: Record<string, string> = {
  aplicacao:            'aplicacoes',
  fazenda:              'fazendas',
  talhao:               'talhoes',
  produto:              'produtos',
  semeadura_etapa:      'semeaduraEtapas',
  estoqueMovimentacao:  'estoqueMovimentacoes',
  recomendacao:         'recomendacoes',
  monitoramento:        'monitoramentos',
}

export async function processSyncQueue(): Promise<void> {
  if (!navigator.onLine) return
  const db = getDB()
  const queue = await db.syncQueue.orderBy('timestamp').toArray()

  for (const item of queue) {
    try {
      const res = await fetch(`/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(item),
      })
      if (res.ok) {
        await db.syncQueue.delete(item.id)
        // Marca como synced usando mapeamento correto (evita bug de snake_case vs camelCase)
        const tableName = ENTITY_TO_DEXIE[item.entity]
        const entityDb = tableName ? (db as unknown as Record<string, { update: (id: string, changes: object) => Promise<unknown> }>)[tableName] : undefined
        if (entityDb && item.action !== 'delete') {
          await entityDb.update((item.data as Record<string, unknown>).id as string, { _syncStatus: 'synced' })
        }
      } else if (item.retries >= 3) {
        // Não descarta silenciosamente: mantém no log mas para de tentar
        // (evita perda de dados por falha temporária do servidor)
        console.warn(`[sync] Falha persistente ao sincronizar ${item.entity}:${(item.data as Record<string,unknown>).id} após 3 tentativas. Item mantido com erro.`)
        await db.syncQueue.update(item.id, { retries: item.retries + 1 })
      } else {
        await db.syncQueue.update(item.id, { retries: item.retries + 1 })
      }
    } catch {
      await db.syncQueue.update(item.id, { retries: item.retries + 1 })
    }
  }
}

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('deckfarm_token') || ''
}

/** Push queue + pull server data. Called periodically and on reconnect. */
async function syncBothWays(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  await processSyncQueue()
  const token = getToken()
  if (token) await pullFromServer(token)
}

export function setupSyncListeners(): void {
  if (typeof window === 'undefined') return
  // On reconnect: push pending + pull latest
  window.addEventListener('online', syncBothWays)
  // Every 30 s: push + pull so open devices see each other's changes
  setInterval(syncBothWays, 30_000)
}
