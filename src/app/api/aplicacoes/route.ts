import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { addDays, parseISO } from 'date-fns'

function calcStatus(proxima: string): string {
  const p = parseISO(proxima)
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const diff = Math.ceil((p.getTime() - hoje.getTime()) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff < 0) return 'atrasado'
  if (diff <= 7) return 'proximo'
  return 'dentro_do_prazo'
}

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const talhao_id = searchParams.get('talhao_id')

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ aplicacoes: [] })

  let query = supabase.from('aplicacoes').select('*, talhoes(nome, fazenda_id), produtos(nome, tipo)').eq('usuario_id', user.id)
  if (talhao_id) query = query.eq('talhao_id', talhao_id) as any

  const { data, error } = await query.order('data_aplicacao', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update statuses
  const updated = (data || []).map((a: any) => ({ ...a, status: calcStatus(a.proxima_aplicacao) }))
  return NextResponse.json({ aplicacoes: updated })
}

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { prazo_produto, ...rest } = body
  const proxima = addDays(parseISO(rest.data_aplicacao), prazo_produto || 0)
  const proxima_str = proxima.toISOString().split('T')[0]

  const aplicacao = {
    ...rest,
    id: rest.id || uuidv4(),
    usuario_id: user.id,
    proxima_aplicacao: proxima_str,
    status: calcStatus(proxima_str),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ aplicacao })

  const { data, error } = await supabase.from('aplicacoes').upsert(aplicacao).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ aplicacao: data })
}
