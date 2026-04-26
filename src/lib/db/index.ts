import Dexie, { Table } from 'dexie'
import type { User, Fazenda, Talhao, Produto, Aplicacao, Notificacao, SyncQueueItem, Safra, FazendaMembro, Pluviometro, RegistroChuva, Anotacao, Recomendacao, RecomendacaoAplicacao, SemeaduraEtapa, EstoqueMovimentacao, MonitoramentoPraga } from '@/types'

export class DeckFarmDB extends Dexie {
  users!: Table<User>
  fazendas!: Table<Fazenda>
  talhoes!: Table<Talhao>
  produtos!: Table<Produto>
  aplicacoes!: Table<Aplicacao>
  notificacoes!: Table<Notificacao>
  syncQueue!: Table<SyncQueueItem>
  safras!: Table<Safra>
  fazendaMembros!: Table<FazendaMembro>
  pluviometros!: Table<Pluviometro>
  registrosChuva!: Table<RegistroChuva>
  anotacoes!: Table<Anotacao>
  recomendacoes!: Table<Recomendacao>
  recomendacaoAplicacoes!: Table<RecomendacaoAplicacao>
  semeaduraEtapas!: Table<SemeaduraEtapa>
  estoqueMovimentacoes!: Table<EstoqueMovimentacao>
  monitoramentos!: Table<MonitoramentoPraga>

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
    this.version(2).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id',
      notificacoes: 'id, usuario_id, lida, data_referencia',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
    })
    // v3: data_plantio on talhoes; tipo on aplicacoes
    this.version(3).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura, data_plantio',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo',
      notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
    })
    // v4: semeadura on talhoes; pluviometria, anotações, recomendações
    this.version(4).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura, data_plantio, status_semeadura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo',
      notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
      pluviometros: 'id, fazenda_id, talhao_id',
      registrosChuva: 'id, pluviometro_id, fazenda_id, data',
      anotacoes: 'id, talhao_id, fazenda_id, usuario_id, data',
      recomendacoes: 'id, fazenda_id, usuario_id, data_inicio, data_fim',
      recomendacaoAplicacoes: 'id, recomendacao_id, talhao_id, produto_id, data_aplicacao',
    })
    // v5: semeadura_etapas — multi-stage sowing tracking per talhão
    this.version(5).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura, data_plantio, status_semeadura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo',
      notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
      pluviometros: 'id, fazenda_id, talhao_id',
      registrosChuva: 'id, pluviometro_id, fazenda_id, data',
      anotacoes: 'id, talhao_id, fazenda_id, usuario_id, data',
      recomendacoes: 'id, fazenda_id, usuario_id, data_inicio, data_fim',
      recomendacaoAplicacoes: 'id, recomendacao_id, talhao_id, produto_id, data_aplicacao',
      semeaduraEtapas: 'id, talhao_id, fazenda_id, usuario_id, etapa, data_semeadura',
    })
    // v6: estoqueMovimentacoes — product stock movement history
    this.version(6).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura, data_plantio, status_semeadura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo',
      notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
      pluviometros: 'id, fazenda_id, talhao_id',
      registrosChuva: 'id, pluviometro_id, fazenda_id, data',
      anotacoes: 'id, talhao_id, fazenda_id, usuario_id, data',
      recomendacoes: 'id, fazenda_id, usuario_id, data_inicio, data_fim',
      recomendacaoAplicacoes: 'id, recomendacao_id, talhao_id, produto_id, data_aplicacao',
      semeaduraEtapas: 'id, talhao_id, fazenda_id, usuario_id, etapa, data_semeadura',
      estoqueMovimentacoes: 'id, produto_id, fazenda_id, usuario_id, data',
    })
    // v7: soft-delete on aplicacoes — sets deleted_at instead of hard-deleting
    this.version(7).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura, data_plantio, status_semeadura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo, deleted_at',
      notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
      pluviometros: 'id, fazenda_id, talhao_id',
      registrosChuva: 'id, pluviometro_id, fazenda_id, data',
      anotacoes: 'id, talhao_id, fazenda_id, usuario_id, data',
      recomendacoes: 'id, fazenda_id, usuario_id, data_inicio, data_fim',
      recomendacaoAplicacoes: 'id, recomendacao_id, talhao_id, produto_id, data_aplicacao',
      semeaduraEtapas: 'id, talhao_id, fazenda_id, usuario_id, etapa, data_semeadura',
      estoqueMovimentacoes: 'id, produto_id, fazenda_id, usuario_id, data',
    })
    // v8: monitoramentos — pest/disease tracking per talhão
    this.version(8).stores({
      users: 'id, email',
      fazendas: 'id, usuario_id, nome',
      talhoes: 'id, fazenda_id, nome, cultura, data_plantio, status_semeadura',
      produtos: 'id, fazenda_id, nome, tipo',
      aplicacoes: 'id, talhao_id, produto_id, usuario_id, data_aplicacao, proxima_aplicacao, status, safra_id, tipo, deleted_at',
      notificacoes: 'id, usuario_id, lida, data_referencia, tipo',
      syncQueue: 'id, entity, action, timestamp',
      safras: 'id, fazenda_id, status, ano_inicio',
      fazendaMembros: 'id, fazenda_id, usuario_id, status',
      pluviometros: 'id, fazenda_id, talhao_id',
      registrosChuva: 'id, pluviometro_id, fazenda_id, data',
      anotacoes: 'id, talhao_id, fazenda_id, usuario_id, data',
      recomendacoes: 'id, fazenda_id, usuario_id, data_inicio, data_fim',
      recomendacaoAplicacoes: 'id, recomendacao_id, talhao_id, produto_id, data_aplicacao',
      semeaduraEtapas: 'id, talhao_id, fazenda_id, usuario_id, etapa, data_semeadura',
      estoqueMovimentacoes: 'id, produto_id, fazenda_id, usuario_id, data',
      monitoramentos: 'id, talhao_id, fazenda_id, usuario_id, data, severidade, tipo',
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
