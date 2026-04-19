import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

async function getUser(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyToken(token)
}

/** Verifica que o talhão pertence ao usuário autenticado (via fazenda). */
async function assertOwnership(
  supabase: ReturnType<typeof createServerClient>,
  talhaoId: string,
  userId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('talhoes')
    .select('id, fazendas!inner(usuario_id)')
    .eq('id', talhaoId)
    .eq('fazendas.usuario_id', userId)
    .maybeSingle()
  return !!data
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()

  // Ownership guard: user must own the fazenda containing this talhão
  const owns = await assertOwnership(supabase, id, user.id)
  if (!owns) {
    logger.warn('talhao_unauthorized_update', { userId: user.id, talhaoId: id })
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await request.json()
  if (!supabase) return NextResponse.json({ talhao: body })

  const { data, error } = await supabase
    .from('talhoes')
    .update({ ...body, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select().single()

  if (error) {
    logger.error('talhao_update_failed', { userId: user.id, talhaoId: id })
    return NextResponse.json({ error: 'Erro ao atualizar talhão' }, { status: 500 })
  }
  return NextResponse.json({ talhao: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()

  // Ownership guard
  const owns = await assertOwnership(supabase, id, user.id)
  if (!owns) {
    logger.warn('talhao_unauthorized_delete', { userId: user.id, talhaoId: id })
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('talhoes')
    .delete()
    .eq('id', id)

  if (error) {
    logger.error('talhao_delete_failed', { userId: user.id, talhaoId: id })
    return NextResponse.json({ error: 'Erro ao excluir talhão' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
