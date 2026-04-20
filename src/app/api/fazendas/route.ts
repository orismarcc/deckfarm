import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { sanitizeString } from '@/lib/security/validate'
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

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await supabase
    .from('fazendas').select('*').eq('usuario_id', user.id).order('nome')

  if (error) {
    logger.error('fazendas_get_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao buscar fazendas' }, { status: 500 })
  }
  return NextResponse.json({ fazendas: data })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()

  const fazenda = {
    id: sanitizeString(body?.id) || uuidv4(),
    nome: sanitizeString(body?.nome, 100),
    nome_produtor: sanitizeString(body?.nome_produtor, 100),
    area: body?.area ?? null,
    localizacao: sanitizeString(body?.localizacao, 255),
    cultura_principal: sanitizeString(body?.cultura_principal, 100),
    usuario_id: user.id, // Always enforce from token — never trust body
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (!fazenda.nome) {
    return NextResponse.json({ error: 'Nome da fazenda obrigatório' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  const { data, error } = await supabase
    .from('fazendas').upsert(fazenda).select().single()

  if (error) {
    logger.error('fazenda_create_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao salvar fazenda' }, { status: 500 })
  }
  return NextResponse.json({ fazenda: data })
}
