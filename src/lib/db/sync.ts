import { getDB } from './index'
import type { SyncQueueItem, Fazenda, Talhao, Produto, Aplicacao } from '@/types'
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

  const [fazendas, talhoes, produtos, aplicacoes] = await Promise.all([
    fetchEntity<Record<string, unknown>>('/api/fazendas',   token, 'fazendas'),
    fetchEntity<Record<string, unknown>>('/api/talhoes',    token, 'talhoes'),
    fetchEntity<Record<string, unknown>>('/api/produtos',   token, 'produtos'),
    fetchEntity<Record<string, unknown>>('/api/aplicacoes', token, 'aplicacoes'),
  ])

  // Write to Dexie (idempotent — safe to run on every startup)
  const cleanFazendas  = fazendas.map(stripJoins)  as unknown as Fazenda[]
  const cleanTalhoes   = talhoes.map(stripJoins)   as unknown as Talhao[]
  const cleanProdutos  = produtos.map(stripJoins)  as unknown as Produto[]
  const cleanAplicacoes = aplicacoes.map(stripJoins) as unknown as Aplicacao[]

  if (cleanFazendas.length)   await db.fazendas.bulkPut(cleanFazendas)
  if (cleanTalhoes.length)    await db.talhoes.bulkPut(cleanTalhoes)
  if (cleanProdutos.length)   await db.produtos.bulkPut(cleanProdutos)
  if (cleanAplicacoes.length) await db.aplicacoes.bulkPut(cleanAplicacoes)

  // ── Update Zustand directly so all subscribed pages re-render immediately ──
  // This bypasses the layout → read Dexie → set Zustand chain and eliminates
  // the race condition where a page's loadData() runs before the layout finishes.
  const store = useAppStore.getState()

  // Merge with existing store data: server wins for matching IDs (server is truth),
  // keep any local-only records not yet synced to the server.
  if (cleanFazendas.length || cleanTalhoes.length || cleanProdutos.length || cleanAplicacoes.length) {
    const mergedFazendas = mergeById(store.fazendas, cleanFazendas)
    const mergedTalhoes  = mergeById(store.talhoes,  cleanTalhoes)
    const mergedProdutos = mergeById(store.produtos,  cleanProdutos)
    const mergedAplicacoes = mergeById(store.aplicacoes, cleanAplicacoes)

    store.setFazendas(mergedFazendas)
    store.setTalhoes(mergedTalhoes)
    store.setProdutos(mergedProdutos)
    store.setAplicacoes(mergedAplicacoes)
  }

  // Signal pull completion — pages subscribed to lastServerSyncAt will re-run loadData()
  store.setLastServerSyncAt(Date.now())
}

/** Merge two arrays by id: serverItems overwrite localItems for same id, extras kept */
function mergeById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of local)  map.set(item.id, item)
  for (const item of server) map.set(item.id, item)   // server wins
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
        // Mark entity as synced
        const entityDb = db[item.entity === 'aplicacao' ? 'aplicacoes' : `${item.entity}s` as keyof typeof db] as any
        if (entityDb && item.action !== 'delete') {
          await entityDb.update((item.data as any).id, { _syncStatus: 'synced' })
        }
      } else if (item.retries >= 3) {
        await db.syncQueue.delete(item.id)
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
