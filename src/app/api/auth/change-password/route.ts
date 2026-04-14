import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientKey } from '@/lib/security/rate-limit'
import { isValidPassword } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per 15 minutes per IP
  const rl = checkRateLimit(getClientKey(request, 'change-password'), 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const token = getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const body = await request.json()
    const { senhaAtual, novaSenha } = body

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }
    const pwCheck = isValidPassword(novaSenha)
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.reason }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!supabase) return NextResponse.json({ ok: true })

    const { data: user, error } = await supabase
      .from('users').select('id, senha').eq('id', payload.id).single()

    if (error || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const valid = await bcrypt.compare(senhaAtual, user.senha)
    if (!valid) {
      logger.warn('change_password_wrong_current', { userId: payload.id })
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }

    const hash = await bcrypt.hash(novaSenha, 12)
    const { error: updateError } = await supabase
      .from('users')
      .update({ senha: hash, updatedAt: new Date().toISOString() })
      .eq('id', payload.id)

    if (updateError) {
      logger.error('change_password_update_failed', { userId: payload.id })
      return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 })
    }

    logger.info('change_password_success', { userId: payload.id })
    return NextResponse.json({ ok: true })
  } catch {
    logger.error('change_password_error')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
