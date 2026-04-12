import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

async function getUser(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyToken(token)
}

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ fazendas: [] })

  const { data, error } = await supabase.from('fazendas').select('*').eq('usuario_id', user.id).order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fazendas: data })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const fazenda = { ...body, id: body.id || uuidv4(), usuario_id: user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ fazenda })

  const { data, error } = await supabase.from('fazendas').upsert(fazenda).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fazenda: data })
}
