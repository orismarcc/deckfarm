import { getDB } from './index'
import type { SyncQueueItem } from '@/types'
import { v4 as uuidv4 } from 'uuid'

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

export function setupSyncListeners(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('online', processSyncQueue)
  setInterval(() => { if (navigator.onLine) processSyncQueue() }, 30000)
}
