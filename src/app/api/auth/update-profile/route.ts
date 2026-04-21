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
    // avatar is a base64 data URL — validate format, pass null to clear
    const avatarRaw = body?.avatar
    const avatarValue: string | null | undefined =
      typeof avatarRaw === 'string' && avatarRaw.startsWith('data:image/') ? avatarRaw
      : avatarRaw === null ? null
      : undefined   // absent from body → don't touch the field

    if (!nome) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      nome,
      apelido: apelido || null,
      updatedAt: new Date().toISOString(),
    }
    if (avatarValue !== undefined) updates.avatar = avatarValue

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
