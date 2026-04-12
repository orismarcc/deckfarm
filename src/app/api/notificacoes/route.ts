import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ notificacoes: [] })

  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', user.id)
    .order('createdAt', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notificacoes: data })
}

export async function PATCH(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await request.json()
  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id).eq('usuario_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
