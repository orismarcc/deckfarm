/**
 * POST /api/push/subscribe
 * Save a Web Push subscription to Supabase (push_subscriptions table).
 * The client sends { subscription: PushSubscriptionJSON, userId: string }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@/lib/auth'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(auth)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscription } = await req.json()
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Upsert — avoid duplicate subscriptions for same endpoint
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          usuario_id: payload.id,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('[push/subscribe]', error)
      // If table doesn't exist yet, still return 200 (graceful)
      if (error.code === '42P01') {
        return NextResponse.json({ ok: true, warn: 'push_subscriptions table missing' })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/subscribe] unexpected', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyToken(auth)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/subscribe DELETE] unexpected', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
