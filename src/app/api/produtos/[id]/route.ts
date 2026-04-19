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

/** Verifica que o produto pertence a uma fazenda do usuário autenticado. */
async function assertOwnership(
  supabase: ReturnType<typeof createServerClient>,
  produtoId: string,
  userId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('produtos')
    .select('id, fazendas!inner(usuario_id)')
    .eq('id', produtoId)
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

  // Ownership guard
  const owns = await assertOwnership(supabase, id, user.id)
  if (!owns) {
    logger.warn('produto_unauthorized_update', { userId: user.id, produtoId: id })
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await request.json()
  if (!supabase) return NextResponse.json({ produto: body })

  const { data, error } = await supabase
    .from('produtos')
    .update({ ...body, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select().single()

  if (error) {
    logger.error('produto_update_failed', { userId: user.id, produtoId: id })
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 })
  }
  return NextResponse.json({ produto: data })
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
    logger.warn('produto_unauthorized_delete', { userId: user.id, produtoId: id })
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', id)

  if (error) {
    logger.error('produto_delete_failed', { userId: user.id, produtoId: id })
    return NextResponse.json({ error: 'Erro ao excluir produto' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
