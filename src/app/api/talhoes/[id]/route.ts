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
