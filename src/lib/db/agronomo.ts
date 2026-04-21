/**
 * Motor agrônomo do DeckFarm.
 *
 * Responsável por:
 * - Calcular e agendar aplicações automáticas a partir da data de plantio
 * - Criar/atualizar safras automaticamente com base nos talhões
 * - Gerar alertas inteligentes a partir de todos os dados cadastrados
 */

import { getDB } from './index'
import type { Talhao, Produto, Aplicacao, CulturaType } from '@/types'
import { addDays, differenceInDays, isToday, isPast, parseISO, format } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

// ── Constantes ──────────────────────────────────────────────────────────────

/** Ciclo médio de cada cultura em dias (plantio → colheita) */
export const CICLO_CULTURA: Record<CulturaType, number> = {
  soja:           110,
  milho:          120,
  milho_safrinha: 115,
  gergelim:       100,
  feijao:          90,
  algodao:        160,
}

// ── Status ──────────────────────────────────────────────────────────────────

function calcStatus(data: string): Aplicacao['status'] {
  const [y, m, dd] = data.split('-').map(Number)
  const d = new Date(y, m - 1, dd)    // local date — no UTC offset bug
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (isToday(d)) return 'hoje'
  if (isPast(d)) return 'atrasado'
  const diff = differenceInDays(d, hoje)
  if (diff <= 7) return 'proximo'
  return 'dentro_do_prazo'
}

// ── Safra ────────────────────────────────────────────────────────────────────

/**
 * Cria ou atualiza a safra correspondente ao talhão.
 * A safra é identificada por fazenda + cultura + ano de plantio.
 */
export async function criarOuAtualizarSafra(talhao: Talhao): Promise<void> {
  if (!talhao.data_plantio) return
  const db = getDB()

  const dataPlantio = parseISO(talhao.data_plantio)
  const anoInicio = dataPlantio.getFullYear()
  const anoFim = anoInicio + 1
  const ciclo = CICLO_CULTURA[talhao.cultura] ?? 120
  const dataColheita = talhao.data_colheita_prevista
    ? talhao.data_colheita_prevista
    : format(addDays(dataPlantio, ciclo), 'yyyy-MM-dd')

  // Procura safra existente (mesma fazenda + cultura + ano)
  const safraExistente = await db.safras
    .where('fazenda_id').equals(talhao.fazenda_id)
    .and(s => s.cultura === talhao.cultura && s.ano_inicio === anoInicio)
    .first()

  const now = new Date().toISOString()
  const talhoes = await db.talhoes.where('fazenda_id').equals(talhao.fazenda_id)
    .and(t => t.cultura === talhao.cultura)
    .toArray()
  const areaTotal = talhoes.reduce((acc, t) => acc + (t.area || 0), 0)

  if (safraExistente) {
    await db.safras.update(safraExistente.id, {
      area_plantada: areaTotal,
      data_colheita_prevista: dataColheita,
      status: 'em_andamento',
      updatedAt: now,
      _syncStatus: 'pending',
    })
  } else {
    await db.safras.add({
      id: uuidv4(),
      nome: `Safra ${anoInicio}/${String(anoFim).slice(-2)}`,
      ano_inicio: anoInicio,
      ano_fim: anoFim,
      fazenda_id: talhao.fazenda_id,
      cultura: talhao.cultura,
      area_plantada: areaTotal,
      data_plantio: talhao.data_plantio,
      data_colheita_prevista: dataColheita,
      status: 'em_andamento',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'pending',
    })
  }
}

// ── Auto-agendamento de aplicações ──────────────────────────────────────────

/**
 * Remove aplicações planejadas antigas e cria novas a partir do plantio.
 * Prioridade: recomendações do agrônomo. Se não houver, usa intervalos padrão dos produtos.
 */
export async function agendarAplicacoesPorPlantio(
  talhao: Talhao,
  produtos: Produto[],
  usuario_id: string,
): Promise<void> {
  if (!talhao.data_plantio || produtos.length === 0) return

  const db = getDB()
  const dataPlantio = parseISO(talhao.data_plantio)
  const ciclo = CICLO_CULTURA[talhao.cultura] ?? 120
  const dataColheita = talhao.data_colheita_prevista
    ? parseISO(talhao.data_colheita_prevista)
    : addDays(dataPlantio, ciclo)

  // Remove aplicações planejadas existentes (padrão) para este talhão
  // Não remove as que foram geradas por recomendação (têm 'Recomendação técnica' em observacoes)
  const existentes = await db.aplicacoes
    .where('talhao_id').equals(talhao.id)
    .and(a => a.tipo === 'planejada' && !a.observacoes?.startsWith('Recomendação técnica'))
    .toArray()
  await Promise.all(existentes.map(a => db.aplicacoes.delete(a.id)))

  // Verifica se há recomendações do agrônomo para este talhão
  const recomendacaoApps = await db.recomendacaoAplicacoes
    .where('talhao_id').equals(talhao.id)
    .toArray()

  const now = new Date().toISOString()
  const novas: Aplicacao[] = []

  if (recomendacaoApps.length > 0) {
    // Usa datas da recomendação do agrônomo — não gera pelo intervalo padrão
    // As aplicações das recomendações já foram criadas pelo módulo de recomendações.
    // Apenas cria o agendamento padrão para produtos SEM recomendação no período.
    const produtosComRec = new Set(recomendacaoApps.map(r => r.produto_id))

    for (const produto of produtos) {
      if (produtosComRec.has(produto.id)) continue // agrônomo cobriu este produto

      const intervalo = produto.prazo_medio_aplicacao || 21
      let dataAplicacao = addDays(dataPlantio, intervalo)
      while (dataAplicacao <= dataColheita) {
        const dataStr = format(dataAplicacao, 'yyyy-MM-dd')
        novas.push({
          id: uuidv4(),
          talhao_id: talhao.id,
          produto_id: produto.id,
          tipo: 'planejada',
          data_aplicacao: dataStr,
          proxima_aplicacao: format(addDays(dataAplicacao, intervalo), 'yyyy-MM-dd'),
          status: calcStatus(dataStr),
          usuario_id,
          createdAt: now,
          updatedAt: now,
          _syncStatus: 'pending',
        })
        dataAplicacao = addDays(dataAplicacao, intervalo)
      }
    }
  } else {
    // Sem recomendação: usa intervalos padrão para todos os produtos
    for (const produto of produtos) {
      const intervalo = produto.prazo_medio_aplicacao || 21
      let dataAplicacao = addDays(dataPlantio, intervalo)
      while (dataAplicacao <= dataColheita) {
        const dataStr = format(dataAplicacao, 'yyyy-MM-dd')
        novas.push({
          id: uuidv4(),
          talhao_id: talhao.id,
          produto_id: produto.id,
          tipo: 'planejada',
          data_aplicacao: dataStr,
          proxima_aplicacao: format(addDays(dataAplicacao, intervalo), 'yyyy-MM-dd'),
          status: calcStatus(dataStr),
          usuario_id,
          createdAt: now,
          updatedAt: now,
          _syncStatus: 'pending',
        })
        dataAplicacao = addDays(dataAplicacao, intervalo)
      }
    }
  }

  if (novas.length > 0) await db.aplicacoes.bulkAdd(novas)
}

// ── Geração de alertas completos ─────────────────────────────────────────────

/**
 * Regenera alertas para o usuário a partir de todas as fontes:
 * - Aplicações planejadas e reais com datas próximas/vencidas
 * - Plantios recentes/pendentes
 * - Colheitas próximas
 *
 * Evita duplicatas verificando por tipo+talhao+data.
 */
export async function gerarAlertasAutomaticos(usuario_id: string): Promise<void> {
  const db = getDB()
  const now = new Date().toISOString()
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  // Busca todos os dados relevantes
  const fazendas = await db.fazendas.where('usuario_id').equals(usuario_id).toArray()
  const fazenda_ids = fazendas.map(f => f.id)
  const talhoes = await db.talhoes.where('fazenda_id').anyOf(fazenda_ids).toArray()
  const talhao_ids = talhoes.map(t => t.id)
  const aplicacoes = await db.aplicacoes.where('talhao_id').anyOf(talhao_ids).toArray()

  // Notificações existentes para evitar duplicatas (por tipo+data+referência)
  const existentes = await db.notificacoes.where('usuario_id').equals(usuario_id).toArray()
  const chaveExistente = new Set(existentes.map(n => `${n.tipo}:${n.talhao_id}:${n.data_referencia}`))

  const novas: typeof existentes = []

  function adicionarAlerta(
    tipo: typeof existentes[0]['tipo'],
    mensagem: string,
    data_referencia: string,
    refs: { talhao_id?: string; fazenda_id?: string; aplicacao_id?: string },
  ) {
    const chave = `${tipo}:${refs.talhao_id ?? ''}:${data_referencia}`
    if (chaveExistente.has(chave)) return
    chaveExistente.add(chave)
    novas.push({
      id: uuidv4(),
      tipo,
      mensagem,
      data_referencia,
      lida: false,
      usuario_id,
      ...refs,
      createdAt: now,
    })
  }

  // ── Alertas de aplicações ────────────────────────────────────────────────
  for (const ap of aplicacoes) {
    const talhao = talhoes.find(t => t.id === ap.talhao_id)
    const nome = talhao?.nome ?? 'Talhão'
    const fazenda = fazendas.find(f => f.id === talhao?.fazenda_id)
    const nomeF = fazenda?.nome ? ` (${fazenda.nome})` : ''

    // Usa data_aplicacao para planejadas, proxima_aplicacao para reais
    const dataRef = ap.tipo === 'planejada' ? ap.data_aplicacao : ap.proxima_aplicacao
    const [ry, rm, rd] = dataRef.split('-').map(Number)
    const dataD = new Date(ry, rm - 1, rd)  // local date
    const diff = differenceInDays(dataD, hoje)

    if (diff < 0) {
      adicionarAlerta('atrasado', `Aplicação atrasada em ${nome}${nomeF}`, dataRef,
        { talhao_id: ap.talhao_id, fazenda_id: talhao?.fazenda_id, aplicacao_id: ap.id })
    } else if (diff === 0) {
      adicionarAlerta('hoje', `Aplicação hoje em ${nome}${nomeF}`, dataRef,
        { talhao_id: ap.talhao_id, fazenda_id: talhao?.fazenda_id, aplicacao_id: ap.id })
    } else if (diff === 1) {
      adicionarAlerta('amanha', `Aplicação amanhã em ${nome}${nomeF}`, dataRef,
        { talhao_id: ap.talhao_id, fazenda_id: talhao?.fazenda_id, aplicacao_id: ap.id })
    } else if (diff <= 3) {
      adicionarAlerta('tres_dias', `Aplicação em ${diff} dias em ${nome}${nomeF}`, dataRef,
        { talhao_id: ap.talhao_id, fazenda_id: talhao?.fazenda_id, aplicacao_id: ap.id })
    } else if (diff <= 7) {
      adicionarAlerta('semana', `Aplicação em ${diff} dias em ${nome}${nomeF}`, dataRef,
        { talhao_id: ap.talhao_id, fazenda_id: talhao?.fazenda_id, aplicacao_id: ap.id })
    }
  }

  // ── Alertas de colheita próxima ─────────────────────────────────────────
  for (const talhao of talhoes) {
    if (!talhao.data_colheita_prevista) continue
    const fazenda = fazendas.find(f => f.id === talhao.fazenda_id)
    const nomeF = fazenda?.nome ? ` — ${fazenda.nome}` : ''
    const [cy, cm, cd] = talhao.data_colheita_prevista.split('-').map(Number)
    const diffColheita = differenceInDays(new Date(cy, cm - 1, cd), hoje)

    if (diffColheita >= 0 && diffColheita <= 7) {
      adicionarAlerta('semana', `Colheita prevista em ${diffColheita === 0 ? 'hoje' : `${diffColheita} dias`}: ${talhao.nome}${nomeF}`,
        talhao.data_colheita_prevista, { talhao_id: talhao.id, fazenda_id: talhao.fazenda_id })
    }
  }

  if (novas.length > 0) {
    await db.notificacoes.bulkAdd(novas)
  }
}
