/**
 * Gerenciamento de membros de fazenda.
 * Apenas o dono da fazenda (usuario_id) pode gerenciar sua equipe.
 *
 * POST /api/fazendas/[id]/membros
 *   Adiciona um membro. Cria conta de usuário se o email não existir.
 *   Retorna senha gerada apenas na criação (mostrar ao admin uma vez).
 *
 * GET  /api/fazendas/[id]/membros
 *   Lista membros da fazenda.
 *
 * DELETE /api/fazendas/[id]/membros?membroId=xxx
 *   Remove membro da fazenda (não exclui a conta de usuário).
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidEmail, isValidUUID, sanitizeString } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

type Params = { params: Promise<{ id: string }> }

/** Verifica que o usuário autenticado é dono da fazenda. */
async function getOwnerOrNull(request: NextRequest, fazendaId: string) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  const user = await verifyToken(token)
  if (!user) return null

  const supabase = createServerClient()
  if (!supabase) return user // offline mode — trust token

  const { data } = await supabase
    .from('fazendas').select('id').eq('id', fazendaId).eq('usuario_id', user.id).single()
  return data ? user : null
}

/** Gera senha legível (ex: Deck-7k2p-Farm). */
function gerarSenhaTemp(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `Deck-${part(4)}-Farm`
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: Params) {
  const { id: fazendaId } = await params
  if (!isValidUUID(fazendaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const user = await getOwnerOrNull(request, fazendaId)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ membros: [] })

  const { data, error } = await supabase
    .from('fazenda_membros')
    .select('*')
    .eq('fazenda_id', fazendaId)
    .order('createdAt')

  if (error) {
    logger.error('membros_get_failed', { fazendaId })
    return NextResponse.json({ error: 'Erro ao buscar membros' }, { status: 500 })
  }
  return NextResponse.json({ membros: data })
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: Params) {
  const { id: fazendaId } = await params
  if (!isValidUUID(fazendaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const user = await getOwnerOrNull(request, fazendaId)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Banco de dados não configurado' }, { status: 503 })

  const body = await request.json()
  const email  = sanitizeString(body?.email, 254).toLowerCase()
  const nome   = sanitizeString(body?.nome, 100)
  const role   = sanitizeString(body?.role, 20) || 'operador'

  if (!email) return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

  const allowedRoles = ['admin', 'agronomo', 'tecnico', 'operador']
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Função inválida' }, { status: 400 })
  }

  // 1. Verificar se já é membro
  const { data: jaEhMembro } = await supabase
    .from('fazenda_membros')
    .select('id')
    .eq('fazenda_id', fazendaId)
    .eq('usuario_email', email)
    .single()

  if (jaEhMembro) {
    return NextResponse.json({ error: 'Este e-mail já é membro desta fazenda' }, { status: 409 })
  }

  // 2. Verificar se usuário já existe
  let usuarioId: string | null = null
  let senhaCriada: string | null = null

  const { data: usuarioExistente } = await supabase
    .from('users').select('id, nome').eq('email', email).single()

  if (usuarioExistente) {
    usuarioId = usuarioExistente.id
  } else {
    // Criar conta de usuário com senha temporária
    senhaCriada = gerarSenhaTemp()
    const nomeUser = nome || email.split('@')[0]
    const hash = await bcrypt.hash(senhaCriada, 12)
    const novoId = uuidv4()
    const now = new Date().toISOString()

    const { error: createErr } = await supabase.from('users').insert({
      id: novoId, nome: nomeUser, email, senha: hash,
      tipo: 'operador', createdAt: now, updatedAt: now,
    })

    if (createErr) {
      logger.error('membro_create_user_failed', { email })
      return NextResponse.json({ error: 'Erro ao criar conta do membro' }, { status: 500 })
    }
    usuarioId = novoId
    logger.info('membro_user_created', { email, userId: novoId })
  }

  // 3. Adicionar à fazenda_membros
  const membro = {
    id: uuidv4(),
    fazenda_id: fazendaId,
    usuario_id: usuarioId,
    usuario_email: email,
    usuario_nome: nome || (usuarioExistente?.nome ?? email.split('@')[0]),
    role,
    status: 'ativo',
    convidado_por: user.id,
    createdAt: new Date().toISOString(),
  }

  const { data: membroSalvo, error: membroErr } = await supabase
    .from('fazenda_membros').insert(membro).select().single()

  if (membroErr) {
    logger.error('membro_insert_failed', { fazendaId, email })
    return NextResponse.json({ error: 'Erro ao adicionar membro' }, { status: 500 })
  }

  logger.info('membro_added', { fazendaId, email, role })

  return NextResponse.json({
    membro: membroSalvo,
    contaCriada: !!senhaCriada,
    // Senha mostrada apenas uma vez — administrador deve repassar ao membro
    senhaTemporaria: senhaCriada ?? undefined,
  })
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: fazendaId } = await params
  if (!isValidUUID(fazendaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const user = await getOwnerOrNull(request, fazendaId)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const membroId = searchParams.get('membroId')

  if (!membroId || !isValidUUID(membroId)) {
    return NextResponse.json({ error: 'membroId inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('fazenda_membros')
    .delete()
    .eq('id', membroId)
    .eq('fazenda_id', fazendaId) // Ownership check

  if (error) {
    logger.error('membro_remove_failed', { fazendaId, membroId })
    return NextResponse.json({ error: 'Erro ao remover membro' }, { status: 500 })
  }

  logger.info('membro_removed', { fazendaId, membroId })
  return NextResponse.json({ ok: true })
}
