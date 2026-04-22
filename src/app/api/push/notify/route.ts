/**
 * POST /api/push/notify
 * Send a push notification to all subscriptions of a user (or all users for a fazenda).
 * Body: { userId?: string, title: string, message: string, url?: string, tag?: string }
 * Protected: requires ADMIN_SECRET header OR valid JWT.
 *
 * NOTE: webpush.setVapidDetails() is called lazily inside the handler (not at module level)
 * so the build doesn't fail when VAPID env vars are absent in the build environment.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Lazy-init: only configure web-push once, on first real request
let webpushConfigured = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let webpushLib: any = null

async function getWebPush() {
  if (!webpushConfigured) {
    const wp = (await import('web-push')).default
    const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject    = process.env.VAPID_SUBJECT || 'mailto:contato@deckfarm.com.br'

    if (!publicKey || !privateKey) {
      throw new Error('VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.')
    }

    wp.setVapidDetails(subject, publicKey, privateKey)
    webpushLib = wp
    webpushConfigured = true
  }
  return webpushLib
}

export async function POST(req: Request) {
  try {
    // Auth: accept admin secret OR valid user JWT
    const adminSecret = req.headers.get('x-admin-secret')
    const authHeader  = req.headers.get('Authorization')?.replace('Bearer ', '')
    const isAdmin     = adminSecret === process.env.ADMIN_SECRET

    if (!isAdmin) {
      const payload = authHeader ? await verifyToken(authHeader) : null
      if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { userId, title, message, url = '/alertas', tag = 'deckfarm-alert' } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message required' }, { status: 400 })
    }

    // Load subscriptions
    let query = supabase.from('push_subscriptions').select('endpoint, keys')
    if (userId) query = query.eq('usuario_id', userId)

    const { data: subs, error } = await query
    if (error) {
      if (error.code === '42P01') return NextResponse.json({ ok: true, sent: 0, warn: 'table missing' })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const wp = await getWebPush()
    const notifPayload = JSON.stringify({ title, body: message, url, tag })
    let sent = 0
    const expired: string[] = []

    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await wp.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            notifPayload
          )
          sent++
        } catch (err: unknown) {
          // 410 Gone = subscription expired, clean it up
          if ((err as { statusCode?: number }).statusCode === 410) {
            expired.push(sub.endpoint)
          }
        }
      })
    )

    // Clean expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }

    return NextResponse.json({ ok: true, sent, expired: expired.length })
  } catch (e) {
    console.error('[push/notify] unexpected', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
