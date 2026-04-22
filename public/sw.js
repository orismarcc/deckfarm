/**
 * DeckFarm Service Worker
 * Strategy: Cache-first for static assets, network-first for API/data.
 * Enables full offline usage after first load.
 */

const CACHE_NAME = 'deckfarm-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/aplicacoes',
  '/cronograma',
  '/fazendas',
  '/manifest.json',
]

// ── Install: pre-cache shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: cache-first for static, network-first for API ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin (except tile servers)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('tile.openstreetmap.org') &&
      !url.hostname.includes('open-meteo.com')) return

  // Network-first for API routes (always fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for tiles (maps work offline after first view)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(request).then(cached => cached ||
        fetch(request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return res
        })
      )
    )
    return
  }

  // Stale-while-revalidate for Next.js static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(request).then(cached => {
        const fetchPromise = fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone())
          return res
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
  )
})

// ── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'DeckFarm', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'deckfarm-alert',
      data: { url: data.url || '/alertas' },
      actions: [
        { action: 'open', title: 'Ver detalhes' },
        { action: 'dismiss', title: 'Dispensar' },
      ],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/alertas'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); client.navigate?.(url); return }
      }
      if (clients.openWindow) clients.openWindow(url)
    })
  )
})
