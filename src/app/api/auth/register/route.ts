import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { nome, email, senha } = await request.json()
    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!supabase) {
      // Offline / no Supabase — return demo token for local use
      const user = { id: uuidv4(), nome, email, tipo: 'agronomo' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      const token = await signToken(user)
      return NextResponse.json({ user, token })
    }

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single()
    if (existing) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })

    const hash = await bcrypt.hash(senha, 10)
    const user = { id: uuidv4(), nome, email, senha: hash, tipo: 'agronomo' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const { error } = await supabase.from('users').insert(user)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { senha: _, ...safeUser } = user
    const token = await signToken(safeUser)
    return NextResponse.json({ user: safeUser, token })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
