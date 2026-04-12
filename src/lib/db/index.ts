import Dexie, { Table } from 'dexie'
import type { User, Fazenda, Talhao, Produto, Aplicacao, Notificacao, SyncQueueItem } from '@/types'

export class DeckFarmDB extends Dexie {
  users!: Table<User>
  fazendas!: Table<Fazenda>
  talhoes!: Table<Talhao>
  produtos!: Table<Produto>
  aplicacoes!: Table<Aplicacao>
  notificacoes!: Table<Notificacao>
  syncQueue!: Table<SyncQueueItem>

  constructor() {
    super('DeckFarmDB')
    this.version(1).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status',
      notificacoes: 'id, usuario_id, lida, data_referencia',
      syncQueue: 'id, entity, action, timestamp',
    })
  }
}

let db: DeckFarmDB | null = null

export function getDB(): DeckFarmDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in browser')
  }
  if (!db) {
    db = new DeckFarmDB()
  }
  return db
}
