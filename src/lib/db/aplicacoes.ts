import { getDB } from './index'
import type { Aplicacao, AplicacaoStatus } from '@/types'
import { addDays, isToday, isPast, differenceInDays, parseISO } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

function calcularStatus(proxima_aplicacao: string): AplicacaoStatus {
  const proxima = parseISO(proxima_aplicacao)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (isToday(proxima)) return 'hoje'
  if (isPast(proxima)) return 'atrasado'
  const diff = differenceInDays(proxima, hoje)
  if (diff <= 7) return 'proximo'
  return 'dentro_do_prazo'
}

export async function criarAplicacao(data: Omit<Aplicacao, 'id' | 'proxima_aplicacao' | 'status' | 'createdAt' | 'updatedAt'> & { prazo_produto: number }): Promise<Aplicacao> {
  const db = getDB()
  const proxima = addDays(parseISO(data.data_aplicacao), data.prazo_produto)
  const proxima_str = proxima.toISOString().split('T')[0]
  const now = new Date().toISOString()

  const aplicacao: Aplicacao = {
    id: uuidv4(),
    talhao_id: data.talhao_id,
    produto_id: data.produto_id,
    data_aplicacao: data.data_aplicacao,
    proxima_aplicacao: proxima_str,
    status: calcularStatus(proxima_str),
    dose: data.dose,
    unidade_dose: data.unidade_dose,
    area_aplicada: data.area_aplicada,
    responsavel: data.responsavel,
    observacoes: data.observacoes,
    clima: data.clima,
    temperatura: data.temperatura,
    fotos: data.fotos,
    usuario_id: data.usuario_id,
    createdAt: now,
    updatedAt: now,
    _syncStatus: 'pending',
  }

  await db.aplicacoes.add(aplicacao)
  await gerarNotificacoes(aplicacao)
  return aplicacao
}

export async function atualizarStatuses(): Promise<void> {
  const db = getDB()
  const all = await db.aplicacoes.toArray()
  const updates = all
    .map(a => ({ ...a, status: calcularStatus(a.proxima_aplicacao) }))
    .filter((a, i) => a.status !== all[i].status)

  for (const a of updates) {
    await db.aplicacoes.update(a.id, { status: a.status, updatedAt: new Date().toISOString() })
  }
}

export async function getAplicacoesByTalhao(talhao_id: string): Promise<Aplicacao[]> {
  const db = getDB()
  return db.aplicacoes.where('talhao_id').equals(talhao_id).reverse().sortBy('data_aplicacao')
}

export async function getAplicacoesByUsuario(usuario_id: string): Promise<Aplicacao[]> {
  const db = getDB()
  return db.aplicacoes.where('usuario_id').equals(usuario_id).toArray()
}

export async function getDashboardStats(usuario_id: string) {
  const db = getDB()
  const fazendas = await db.fazendas.where('usuario_id').equals(usuario_id).toArray()
  const fazenda_ids = fazendas.map(f => f.id)
  const talhoes = await db.talhoes.where('fazenda_id').anyOf(fazenda_ids).toArray()
  const talhao_ids = talhoes.map(t => t.id)
  const aplicacoes = await db.aplicacoes.where('talhao_id').anyOf(talhao_ids).toArray()

  return {
    hoje: aplicacoes.filter(a => a.status === 'hoje').length,
    atrasadas: aplicacoes.filter(a => a.status === 'atrasado').length,
    proximas: aplicacoes.filter(a => a.status === 'proximo').length,
    dentro_prazo: aplicacoes.filter(a => a.status === 'dentro_do_prazo').length,
    total_fazendas: fazendas.length,
    total_talhoes: talhoes.length,
    total_aplicacoes: aplicacoes.length,
  }
}

async function gerarNotificacoes(aplicacao: Aplicacao): Promise<void> {
  const db = getDB()
  const proxima = parseISO(aplicacao.proxima_aplicacao)
  const now = new Date().toISOString()

  const notifications = [
    { dias: 7, tipo: 'semana' as const, msg: `Falta 1 semana para aplicação` },
    { dias: 3, tipo: 'tres_dias' as const, msg: `Faltam 3 dias para aplicação` },
    { dias: 1, tipo: 'amanha' as const, msg: `Aplicação amanhã` },
    { dias: 0, tipo: 'hoje' as const, msg: `Aplicação hoje` },
  ]

  for (const n of notifications) {
    await db.notificacoes.add({
      id: uuidv4(),
      tipo: n.tipo,
      mensagem: n.msg,
      data_referencia: addDays(proxima, -n.dias).toISOString().split('T')[0],
      lida: false,
      usuario_id: aplicacao.usuario_id,
      aplicacao_id: aplicacao.id,
      talhao_id: aplicacao.talhao_id,
      createdAt: now,
    })
  }
}
