import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID, sanitizeString } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'
import { v4 as uuidv4 } from 'uuid'
import { addDays, parseISO } from 'date-fns'

function calcStatus(proxima: string): string {
  try {
    const p = parseISO(proxima)
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const diff = Math.ceil((p.getTime() - hoje.getTime()) / 86400000)
    if (diff === 0) return 'hoje'
    if (diff < 0) return 'atrasado'
    if (diff <= 7) return 'proximo'
    return 'dentro_do_prazo'
  } catch {
    return 'dentro_do_prazo'
  }
}

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const talhao_id = searchParams.get('talhao_id')

  if (talhao_id && !isValidUUID(talhao_id)) {
    return NextResponse.json({ error: 'talhao_id inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ aplicacoes: [] })

  let query = supabase
    .from('aplicacoes')
    .select('*, talhoes(nome, fazenda_id), produtos(nome, tipo)')
    .eq('usuario_id', user.id)

  if (talhao_id) query = query.eq('talhao_id', talhao_id) as typeof query

  const { data, error } = await query.order('data_aplicacao', { ascending: false })

  if (error) {
    logger.error('aplicacoes_get_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao buscar aplicações' }, { status: 500 })
  }

  const updated = (data || []).map((a: Record<string, unknown>) => ({
    ...a,
    status: calcStatus(a.proxima_aplicacao as string),
  }))
  return NextResponse.json({ aplicacoes: updated })
}

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { prazo_produto, ...rest } = body

  if (!rest.data_aplicacao) {
    return NextResponse.json({ error: 'data_aplicacao obrigatória' }, { status: 400 })
  }

  let proxima_str: string
  try {
    const proxima = addDays(parseISO(rest.data_aplicacao), Number(prazo_produto) || 0)
    proxima_str = proxima.toISOString().split('T')[0]
  } catch {
    return NextResponse.json({ error: 'data_aplicacao inválida' }, { status: 400 })
  }

  const aplicacao = {
    ...rest,
    id: sanitizeString(rest.id) || uuidv4(),
    usuario_id: user.id, // Always enforce from token
    proxima_aplicacao: proxima_str,
    status: calcStatus(proxima_str),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ aplicacao })

  const { data, error } = await supabase
    .from('aplicacoes').upsert(aplicacao).select().single()

  if (error) {
    logger.error('aplicacao_create_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao salvar aplicação' }, { status: 500 })
  }
  return NextResponse.json({ aplicacao: data })
}
