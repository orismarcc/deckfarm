import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { isValidUUID } from '@/lib/security/validate'
import { logger } from '@/lib/security/logger'

// Strict allow-list of tables the sync route can touch
const TABLE_MAP: Record<string, string> = {
  fazenda:          'fazendas',
  talhao:           'talhoes',
  produto:          'produtos',
  aplicacao:        'aplicacoes',
  semeadura_etapa:  'semeadura_etapas',
}

const ALLOWED_ACTIONS = ['upsert', 'delete'] as const
type SyncAction = typeof ALLOWED_ACTIONS[number]

/**
 * Per-entity field allowlists.
 * Only these columns are ever written to Supabase — prevents mass-assignment
 * attacks where a client sends extra fields (e.g. usuario_id on talhões,
 * internal admin flags, etc.).
 */
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  fazendas: new Set([
    'id', 'nome', 'localizacao', 'nome_produtor', 'area_total',
    'latitude', 'longitude', 'usuario_id', 'createdAt', 'updatedAt',
  ]),
  talhoes: new Set([
    'id', 'nome', 'area', 'cultura', 'fazenda_id',
    'latitude', 'longitude', 'descricao', 'foto',
    'data_plantio', 'data_colheita_prevista', 'data_colheita_real',
    'status_semeadura', 'area_semeada', 'createdAt', 'updatedAt',
  ]),
  produtos: new Set([
    'id', 'nome', 'tipo', 'prazo_medio_aplicacao', 'fabricante',
    'registro_mapa', 'unidade', 'quantidade_disponivel', 'unidade_quantidade',
    'fazenda_id', 'createdAt', 'updatedAt',
  ]),
  aplicacoes: new Set([
    'id', 'talhao_id', 'produto_id', 'safra_id', 'tipo',
    'data_aplicacao', 'proxima_aplicacao', 'status',
    'dose', 'unidade_dose', 'area_aplicada', 'responsavel',
    'observacoes', 'clima', 'temperatura', 'fotos',
    'usuario_id', 'createdAt', 'updatedAt',
  ]),
  semeadura_etapas: new Set([
    'id', 'talhao_id', 'fazenda_id', 'usuario_id',
    'etapa', 'area_semeada', 'data_semeadura', 'observacoes',
    'createdAt', 'updatedAt',
  ]),
}

function pickAllowedFields(data: Record<string, unknown>, table: string): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[table]
  if (!allowed) return {}
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => allowed.has(k))
  )
}

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
  if (!dataId || !isValidUUID(dataId as string)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!supabase) {
    logger.error('sync_supabase_unavailable', { userId: user.id, table, action })
    return NextResponse.json({ error: 'Supabase não configurado' }, { status: 503 })
  }

  if (action === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', dataId)
    if (error) {
      logger.error('sync_delete_failed', { userId: user.id, table, id: dataId })
      return NextResponse.json({ error: 'Erro ao sincronizar exclusão' }, { status: 500 })
    }
  } else {
    // Apply field allowlist (prevents mass-assignment) + strip client-only fields
    const payload = pickAllowedFields(item.data ?? {}, table)

    // Force usuario_id to the authenticated user for owned tables — client cannot override
    if (table === 'fazendas' || table === 'aplicacoes' || table === 'semeadura_etapas') {
      payload.usuario_id = user.id
    }

    // id must always be present
    payload.id = dataId

    const { error } = await supabase.from(table).upsert(payload)
    if (error) {
      logger.error('sync_upsert_failed', { userId: user.id, table, id: dataId })
      return NextResponse.json({ error: 'Erro ao sincronizar dados' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
