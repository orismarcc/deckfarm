import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ talhao: body })

  const { data, error } = await supabase.from('talhoes').update({ ...body, updatedAt: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ talhao: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createServerClient()
  if (!supabase) return NextResponse.json({ ok: true })

  const { error } = await supabase.from('talhoes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
