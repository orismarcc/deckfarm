import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { sanitizeString } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const body = await request.json()
    const nome    = sanitizeString(body?.nome, 100)
    const apelido = sanitizeString(body?.apelido, 50)

    if (!nome) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    }

    const updates = {
      nome,
      apelido: apelido || null,
      updatedAt: new Date().toISOString(),
    }

    const supabase = createServerClient()
    if (!supabase) {
      return NextResponse.json({ user: { ...payload, ...updates } })
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', payload.id)

    if (error) {
      logger.error('update_profile_failed', { userId: payload.id })
      return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
    }

    return NextResponse.json({ user: { ...payload, ...updates } })
  } catch {
    logger.error('update_profile_error')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
