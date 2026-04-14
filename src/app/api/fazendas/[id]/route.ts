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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ fazenda: body })

  const { data, error } = await supabase
    .from('fazendas')
    .update({ ...body, usuario_id: user.id, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', user.id) // Ownership check
    .select().single()

  if (error) {
    logger.error('fazenda_update_failed', { userId: user.id, fazendaId: id })
    return NextResponse.json({ error: 'Erro ao atualizar fazenda' }, { status: 500 })
  }
  return NextResponse.json({ fazenda: data })
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
  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('fazendas')
    .delete()
    .eq('id', id)
    .eq('usuario_id', user.id) // Ownership check

  if (error) {
    logger.error('fazenda_delete_failed', { userId: user.id, fazendaId: id })
    return NextResponse.json({ error: 'Erro ao excluir fazenda' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
