import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientKey } from '@/lib/security/rate-limit'
import { isValidEmail, isValidPassword, sanitizeString } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  const rl = checkRateLimit(getClientKey(request, 'register'), 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    logger.warn('rate_limit_exceeded', { endpoint: 'register', retryAfter: rl.retryAfter })
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const body = await request.json()
    const nome    = sanitizeString(body?.nome, 100)
    const apelido = sanitizeString(body?.apelido, 50)
    const email   = sanitizeString(body?.email, 254)
    const senha   = typeof body?.senha === 'string' ? body.senha : ''

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    const pwCheck = isValidPassword(senha)
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.reason }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!supabase) {
      const user = {
        id: uuidv4(), nome, apelido: apelido || undefined, email,
        tipo: 'agronomo' as const,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      const token = await signToken(user)
      return NextResponse.json({ user, token })
    }

    // Check duplicate email
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email).single()
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }

    const hash = await bcrypt.hash(senha, 12) // 12 rounds for production
    const userBase = {
      id: uuidv4(), nome, email, senha: hash,
      tipo: 'agronomo' as const,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }

    // Try with apelido; if column missing, retry without it
    let insertError: { message: string } | null = null
    if (apelido) {
      const res = await supabase.from('users').insert({ ...userBase, apelido })
      insertError = res.error
      if (insertError?.message?.includes('apelido')) {
        const res2 = await supabase.from('users').insert(userBase)
        insertError = res2.error
      }
    } else {
      const res = await supabase.from('users').insert(userBase)
      insertError = res.error
    }

    if (insertError) {
      logger.error('register_insert_failed', { message: insertError.message })
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
    }

    const { senha: _, ...safeUser } = { ...userBase, apelido: apelido || undefined }
    const token = await signToken(safeUser)
    logger.info('register_success', { userId: userBase.id })
    return NextResponse.json({ user: safeUser, token })
  } catch {
    logger.error('register_error')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
