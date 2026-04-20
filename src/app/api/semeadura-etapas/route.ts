import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/security/logger'

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })

  // Fetch all etapas for talhões that belong to the authenticated user
  const { data, error } = await supabase
    .from('semeadura_etapas')
    .select('*, talhoes!inner(fazendas!inner(usuario_id))')
    .eq('talhoes.fazendas.usuario_id', user.id)
    .order('etapa')

  if (error) {
    logger.error('semeadura_etapas_get_failed', { userId: user.id })
    return NextResponse.json({ error: 'Erro ao buscar etapas de semeadura' }, { status: 500 })
  }
  return NextResponse.json({ semeadura_etapas: data ?? [] })
}
