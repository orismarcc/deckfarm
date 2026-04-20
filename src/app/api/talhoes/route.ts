import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID, sanitizeString } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'
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

  if (fazenda_id && !isValidUUID(fazenda_id)) {
    return NextResponse.json({ error: 'fazenda_id inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  let query = supabase
    .from('talhoes')
    .select('*, fazendas!inner(usuario_id)')
    .eq('fazendas.usuario_id', user.id)

  if (fazenda_id) query = query.eq('fazenda_id', fazenda_id) as typeof query

  const { data, error } = await query.order('nome')

  if (error) {
    logger.error('talhoes_get_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao buscar talhões' }, { status: 500 })
  }
  return NextResponse.json({ talhoes: data })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const talhao = {
    ...body,
    id: sanitizeString(body?.id) || uuidv4(),
    nome: sanitizeString(body?.nome, 100),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (!talhao.nome) {
    return NextResponse.json({ error: 'Nome do talhão obrigatório' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await supabase
    .from('talhoes').upsert(talhao).select().single()

  if (error) {
    logger.error('talhao_create_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao salvar talhão' }, { status: 500 })
  }
  return NextResponse.json({ talhao: data })
}
