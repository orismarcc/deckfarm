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
  if (!supabase) return NextResponse.json({ produtos: [] })

  let query = supabase.from('produtos').select('*')
  if (fazenda_id) query = query.eq('fazenda_id', fazenda_id)

  const { data, error } = await query.order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ produtos: data })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const produto = { ...body, id: body.id || uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ produto })

  const { data, error } = await supabase.from('produtos').upsert(produto).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ produto: data })
}
