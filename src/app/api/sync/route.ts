import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

// Strict allow-list of tables the sync route can touch
const TABLE_MAP: Record<string, string> = {
  fazenda:  'fazendas',
  talhao:   'talhoes',
  produto:  'produtos',
  aplicacao: 'aplicacoes',
}

const ALLOWED_ACTIONS = ['upsert', 'delete'] as const
type SyncAction = typeof ALLOWED_ACTIONS[number]

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let item: { entity?: string; action?: string; data?: Record<string, unknown> }
  try {
    item = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // Validate entity
  const table = item.entity ? TABLE_MAP[item.entity] : undefined
  if (!table) {
    return NextResponse.json({ error: 'Entidade inválida' }, { status: 400 })
  }

  // Validate action
  const action = item.action as SyncAction
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  // Validate data.id
  const dataId = item.data?.id
  if (!dataId || !isValidUUID(dataId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: true })

  if (action === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', dataId)
    if (error) {
      logger.error('sync_delete_failed', { userId: user.id, table, id: dataId })
      return NextResponse.json({ error: 'Erro ao sincronizar exclusão' }, { status: 500 })
    }
  } else {
    // Strip client-only fields that don't exist in the DB
    const { _syncStatus, talhao, produto, aplicacao: _ap, ...rest } = item.data as Record<string, unknown> & { _syncStatus?: unknown; talhao?: unknown; produto?: unknown; aplicacao?: unknown }
    const payload = { ...rest }
    // Force usuario_id to match the authenticated user for owned tables
    if (table === 'fazendas' || table === 'aplicacoes') {
      payload.usuario_id = user.id
    }
    const { error } = await supabase.from(table).upsert(payload)
    if (error) {
      logger.error('sync_upsert_failed', { userId: user.id, table, id: dataId })
      return NextResponse.json({ error: 'Erro ao sincronizar dados' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
