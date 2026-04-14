import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ notificacoes: [] })

  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', user.id)
    .order('createdAt', { ascending: false })
    .limit(50)

  if (error) {
    logger.error('notificacoes_get_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
  }
  return NextResponse.json({ notificacoes: data })
}

export async function PATCH(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { id } = body

  if (!id || !isValidUUID(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('id', id)
    .eq('usuario_id', user.id) // Ownership check

  if (error) {
    logger.error('notificacao_mark_read_failed', { userId: user.id, notificacaoId: id })
    return NextResponse.json({ error: 'Erro ao marcar notificação' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
