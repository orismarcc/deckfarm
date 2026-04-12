import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { email, senha } = await request.json()
    if (!email || !senha) return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })

    const supabase = createServerClient()
    if (!supabase) {
      // Demo mode without Supabase
      const user = { id: 'demo-user', nome: 'Usuário Demo', email, tipo: 'agronomo' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      const token = await signToken(user)
      return NextResponse.json({ user, token })
    }

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single()
    if (error || !user) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    const valid = await bcrypt.compare(senha, user.senha)
    if (!valid) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })

    const { senha: _, ...safeUser } = user
    const token = await signToken(safeUser)
    return NextResponse.json({ user: safeUser, token })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
