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
      logger.error('register_supabase_unavailable')
      return NextResponse.json({ error: 'Serviço indisponível. Tente novamente.' }, { status: 503 })
    }

    // Check duplicate email
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email).single()
    if (existing) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
    }

    const hash = await bcrypt.hash(senha, 12) // 12 rounds for production
    const now = new Date().toISOString()
    const userBase = {
      id: uuidv4(), nome, email, senha: hash,
      tipo: 'agronomo' as const,
      createdAt: now, updatedAt: now,
    }

    // Try with apelido; if column missing, retry without it
    // In both cases, SELECT the row back to confirm the UUID actually stored in the DB
    let insertedUser: Record<string, unknown> | null = null
    let insertError: { message: string } | null = null

    if (apelido) {
      const res = await supabase
        .from('users').insert({ ...userBase, apelido }).select('*').single()
      insertError = res.error
      insertedUser = res.data as Record<string, unknown> | null
      if (insertError?.message?.includes('apelido')) {
        // apelido column doesn't exist — retry without it
        const res2 = await supabase
          .from('users').insert(userBase).select('*').single()
        insertError = res2.error
        insertedUser = res2.data as Record<string, unknown> | null
      }
    } else {
      const res = await supabase
        .from('users').insert(userBase).select('*').single()
      insertError = res.error
      insertedUser = res.data as Record<string, unknown> | null
    }

    if (insertError || !insertedUser) {
      logger.error('register_insert_failed', { message: insertError?.message })
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
    }

    // Use the UUID that was ACTUALLY stored in the DB (not the client-generated one)
    const { senha: _, ...safeUser } = insertedUser as Record<string, unknown> & { senha: string }
    const token = await signToken(safeUser as Omit<import('@/types').User, 'senha'>)
    logger.info('register_success', { userId: insertedUser.id })
    return NextResponse.json({ user: safeUser, token })
  } catch {
    logger.error('register_error')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
