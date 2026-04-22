import { getDB } from './index'
import { enqueueSync, processSyncQueue } from './sync'
import type { Aplicacao, AplicacaoStatus } from '@/types'
import { addDays, isToday, isPast, differenceInDays, parseISO, format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

function calcularStatus(data_referencia: string | undefined): AplicacaoStatus {
  if (!data_referencia) return 'dentro_do_prazo'
  // Parse as local date to avoid UTC midnight → previous day in Brazil (X-1 bug)
  const [y, m, d] = data_referencia.split('-').map(Number)
  const ref = new Date(y, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (isToday(ref)) return 'hoje'
  if (isPast(ref)) return 'atrasado'
  const diff = differenceInDays(ref, hoje)
  if (diff <= 7) return 'proximo'
  return 'dentro_do_prazo'
}

// prazo_produto é opcional — campo "prazo_medio_aplicacao" é apenas sugestivo
export async function criarAplicacao(
  data: Omit<Aplicacao, 'id' | 'proxima_aplicacao' | 'status' | 'createdAt' | 'updatedAt'> & {
    prazo_produto?: number
  }
): Promise<Aplicacao> {
  const db = getDB()
  const now = new Date().toISOString()

  // proxima_aplicacao: apenas calculada se prazo_produto foi explicitamente fornecido
  let proxima_str: string | undefined
  if (data.prazo_produto) {
    const [ay, am, ad] = data.data_aplicacao.split('-').map(Number)
    proxima_str = format(addDays(new Date(ay, am - 1, ad), data.prazo_produto), 'yyyy-MM-dd')
  }

  const aplicacao: Aplicacao = {
    id: uuidv4(),
    talhao_id: data.talhao_id,
    produto_id: data.produto_id,
    tipo: data.tipo,
    data_aplicacao: data.data_aplicacao,
    proxima_aplicacao: proxima_str,
    status: calcularStatus(proxima_str ?? data.data_aplicacao),
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
  // Sync to Supabase
  await enqueueSync('aplicacao', 'upsert', aplicacao as unknown as Record<string, unknown>)
  processSyncQueue()
  return aplicacao
}

export async function atualizarStatuses(): Promise<void> {
  const db = getDB()
  const all = await db.aplicacoes.toArray()
  const updates = all
    .map(a => ({ ...a, status: calcularStatus(a.proxima_aplicacao ?? a.data_aplicacao) }))
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
  // Só gera notificações se proxima_aplicacao está definida
  if (!aplicacao.proxima_aplicacao) return

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
      data_referencia: format(addDays(proxima, -n.dias), 'yyyy-MM-dd'),
      lida: false,
      usuario_id: aplicacao.usuario_id,
      aplicacao_id: aplicacao.id,
      talhao_id: aplicacao.talhao_id,
      createdAt: now,
    })
  }
}
