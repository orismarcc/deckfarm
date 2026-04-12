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

  const { searchParams } = new URL(request.url)
  const fazenda_id = searchParams.get('fazenda_id')

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ talhoes: [] })

  let query = supabase.from('talhoes').select('*, fazendas!inner(usuario_id)').eq('fazendas.usuario_id', user.id)
  if (fazenda_id) query = query.eq('fazenda_id', fazenda_id) as any

  const { data, error } = await query.order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ talhoes: data })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const talhao = { ...body, id: body.id || uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ talhao })

  const { data, error } = await supabase.from('talhoes').upsert(talhao).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ talhao: data })
}
