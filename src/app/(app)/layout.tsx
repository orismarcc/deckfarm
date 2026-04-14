'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Header } from '@/components/layout/header'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { useThemeStore, applyTheme } from '@/store/theme'
import { setupSyncListeners, processSyncQueue } from '@/lib/db/sync'
import { atualizarStatuses } from '@/lib/db/aplicacoes'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { setOnline } = useAppStore()
  const { theme } = useThemeStore()

  // Apply theme on mount and changes
  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return }

    setupSyncListeners()

    const handleOnline  = () => { setOnline(true); processSyncQueue() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOnline(navigator.onLine)

    try { atualizarStatuses() } catch {}

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isAuthenticated, router, setOnline])

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
