'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import {
  LayoutDashboard, MapPin, Leaf, FlaskConical, CalendarDays,
  Bell, LogOut, Wifi, WifiOff, RefreshCw, Sprout
} from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/fazendas', icon: MapPin, label: 'Fazendas' },
  { href: '/talhoes', icon: Leaf, label: 'Talhões' },
  { href: '/aplicacoes', icon: FlaskConical, label: 'Aplicações' },
  { href: '/cronograma', icon: CalendarDays, label: 'Cronograma' },
  { href: '/alertas', icon: Bell, label: 'Alertas' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { isOnline, isSyncing, notificacoes } = useAppStore()
  const unread = notificacoes.filter(n => !n.lida).length

  return (
    <aside className="hidden md:flex flex-col w-64 bg-gray-900 text-white min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
        <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
          <Sprout className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-lg">DeckFarm</span>
          <p className="text-xs text-gray-400">Gestão Agrícola</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          const showBadge = href === '/alertas' && unread > 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sync status */}
      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isOnline ? (
            <><Wifi className="w-3.5 h-3.5 text-green-400" /><span>Online</span></>
          ) : (
            <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span>Offline</span></>
          )}
          {isSyncing && <RefreshCw className="w-3.5 h-3.5 animate-spin ml-auto" />}
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-700 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold">
          {user?.nome?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user?.nome}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
        <button onClick={logout} className="p-1.5 rounded-lg hover:bg-gray-800 transition" title="Sair">
          <LogOut className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </aside>
  )
}
