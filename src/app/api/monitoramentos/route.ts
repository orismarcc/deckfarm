import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const talhao_id  = searchParams.get('talhao_id')
  const fazenda_id = searchParams.get('fazenda_id')

  if (talhao_id  && !isValidUUID(talhao_id))  return NextResponse.json({ error: 'talhao_id inválido'  }, { status: 400 })
  if (fazenda_id && !isValidUUID(fazenda_id)) return NextResponse.json({ error: 'fazenda_id inválido' }, { status: 400 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  let query = supabase
    .from('monitoramentos')
    .select('*')
    .eq('usuario_id', user.id)

  if (talhao_id)  query = query.eq('talhao_id',  talhao_id)  as typeof query
  if (fazenda_id) query = query.eq('fazenda_id', fazenda_id) as typeof query

  const { data, error } = await query.order('data', { ascending: false })

  if (error) {
    logger.error('monitoramentos_get_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao buscar monitoramentos' }, { status: 500 })
  }

  return NextResponse.json({ monitoramentos: data ?? [] })
}

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const record = {
    ...body,
    usuario_id: user.id,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await supabase
    .from('monitoramentos')
    .upsert(record)
    .select()
    .single()

  if (error) {
    logger.error('monitoramento_upsert_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao salvar monitoramento' }, { status: 500 })
  }

  return NextResponse.json({ monitoramento: data })
}
