'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { LayoutDashboard, MapPin, FlaskConical, CalendarDays, Bell } from 'lucide-react'

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { href: '/fazendas', icon: MapPin, label: 'Fazendas' },
  { href: '/aplicacoes', icon: FlaskConical, label: 'Aplicar' },
  { href: '/cronograma', icon: CalendarDays, label: 'Agenda' },
  { href: '/alertas', icon: Bell, label: 'Alertas' },
]

export function MobileNav() {
  const pathname = usePathname()
  const { notificacoes } = useAppStore()
  const unread = notificacoes.filter(n => !n.lida).length

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-bottom">
      <div className="flex">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          const showBadge = href === '/alertas' && unread > 0
          return (
            <Link key={href} href={href} className={cn('flex-1 flex flex-col items-center py-2 gap-0.5', active ? 'text-green-600' : 'text-gray-500')}>
              <div className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
              </div>
              <span className="text-xs">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
