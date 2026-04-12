'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Header } from '@/components/layout/header'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { setupSyncListeners, processSyncQueue } from '@/lib/db/sync'
import { atualizarStatuses } from '@/lib/db/aplicacoes'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { setOnline } = useAppStore()

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return }

    // Setup sync
    setupSyncListeners()

    // Online/offline tracking
    const handleOnline = () => { setOnline(true); processSyncQueue() }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setOnline(navigator.onLine)

    // Update statuses on load
    try { atualizarStatuses() } catch {}

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isAuthenticated, router, setOnline])

  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
