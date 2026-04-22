'use client'
/**
 * usePushNotifications
 * Manages the full lifecycle of Web Push subscriptions:
 * 1. Check if the browser supports push
 * 2. Request notification permission
 * 3. Subscribe to the VAPID push server
 * 4. POST the subscription to /api/push/subscribe
 * 5. Persist state in localStorage so we don't re-ask every mount
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const LS_KEY = 'deckfarm-push-subscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

export function usePushNotifications() {
  const { token } = useAuthStore()
  const [supported, setSupported]     = useState(false)
  const [permission, setPermission]   = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed]   = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
    setSupported(ok)
    if (ok) {
      setPermission(Notification.permission)
      setSubscribed(localStorage.getItem(LS_KEY) === '1')
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!supported || !token) return
    setLoading(true); setError(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Permissão de notificação negada.')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })

      if (!res.ok) throw new Error('Falha ao registrar assinatura no servidor.')

      localStorage.setItem(LS_KEY, '1')
      setSubscribed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ativar notificações.')
    } finally { setLoading(false) }
  }, [supported, token])

  const unsubscribe = useCallback(async () => {
    if (!supported || !token) return
    setLoading(true); setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      localStorage.removeItem(LS_KEY)
      setSubscribed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao desativar notificações.')
    } finally { setLoading(false) }
  }, [supported, token])

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe }
}
