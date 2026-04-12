import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const item = await request.json()
  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: true })

  const tableMap: Record<string, string> = {
    fazenda: 'fazendas',
    talhao: 'talhoes',
    produto: 'produtos',
    aplicacao: 'aplicacoes',
  }
  const table = tableMap[item.entity]
  if (!table) return NextResponse.json({ error: 'Entidade inválida' }, { status: 400 })

  if (item.action === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', item.data.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from(table).upsert(item.data)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
