import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientKey } from '@/lib/security/rate-limit'
import { isValidEmail, sanitizeString } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per 15 minutes per IP
  const rl = checkRateLimit(getClientKey(request, 'login'), 10, 15 * 60 * 1000)
  if (!rl.allowed) {
    logger.warn('rate_limit_exceeded', { endpoint: 'login', retryAfter: rl.retryAfter })
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const body = await request.json()
    const email = sanitizeString(body?.email, 254)
    const senha = typeof body?.senha === 'string' ? body.senha : ''

    if (!email || !senha) {
      return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!supabase) {
      logger.error('login_supabase_unavailable')
      return NextResponse.json({ error: 'Serviço indisponível. Tente novamente.' }, { status: 503 })
    }

    const { data: user, error } = await supabase
      .from('users').select('*').eq('email', email).single()

    // Use constant-time comparison to prevent timing attacks
    const dummyHash = '$2b$10$invalidhashfortimingneutralization000000000000000000000'
    const hashToCompare = (error || !user) ? dummyHash : user.senha
    const valid = await bcrypt.compare(senha, hashToCompare)

    if (error || !user || !valid) {
      logger.warn('login_failed', { email })
      // Always return the same message — don't reveal whether email exists
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    const { senha: _, ...safeUser } = user
    const token = await signToken(safeUser)
    logger.info('login_success', { userId: user.id })
    return NextResponse.json({ user: safeUser, token })
  } catch {
    logger.error('login_error')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
