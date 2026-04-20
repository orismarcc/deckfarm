'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Header } from '@/components/layout/header'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { useThemeStore, applyTheme } from '@/store/theme'
import { setupSyncListeners, processSyncQueue, pullFromServer } from '@/lib/db/sync'
// Note: setupSyncListeners already registers the 30s interval that calls both
// processSyncQueue + pullFromServer, so all open devices stay in sync automatically.
import { atualizarStatuses } from '@/lib/db/aplicacoes'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, _hasHydrated, token } = useAuthStore()
  const { setOnline, setSyncing } = useAppStore()
  const { theme } = useThemeStore()

  // Apply theme on mount and changes
  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    if (!_hasHydrated) return
    if (!isAuthenticated) { router.push('/login'); return }

    setupSyncListeners()

    const handleOnline  = () => { setOnline(true) }  // setupSyncListeners already handles push+pull on online
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOnline(navigator.onLine)

    try { atualizarStatuses() } catch {}

    // 1. Push any pending local changes, then 2. pull server state.
    // pullFromServer() updates Dexie AND Zustand directly, so every
    // subscribed page re-renders as soon as data arrives — no race condition.
    const syncOnStartup = async () => {
      setSyncing(true)
      try {
        await processSyncQueue()
        if (token) await pullFromServer(token)
      } finally {
        setSyncing(false)
      }
    }

    syncOnStartup()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isAuthenticated, _hasHydrated, router, token, setOnline, setSyncing])

  if (!_hasHydrated) return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--verde-500)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto pb-24 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
