'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { LayoutDashboard, MapPin, FlaskConical, CalendarDays, Bell } from 'lucide-react'

const nav = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Início' },
  { href: '/fazendas',   icon: MapPin,           label: 'Fazendas' },
  { href: '/aplicacoes', icon: FlaskConical,     label: 'Aplicar' },
  { href: '/cronograma', icon: CalendarDays,     label: 'Agenda' },
  { href: '/alertas',    icon: Bell,             label: 'Alertas' },
]

export function MobileNav() {
  const pathname = usePathname()
  const { notificacoes } = useAppStore()
  const unread = notificacoes.filter(n => !n.lida).length

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div
        className="mx-3 mb-1.5 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 10px 40px -4px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            const isAlertas = href === '/alertas'
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all duration-150',
                  active ? 'text-[--primary]' : 'text-[--fg-subtle]'
                )}
              >
                <div className="relative">
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-150',
                    active && 'bg-[--primary]/10'
                  )}>
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  {isAlertas && unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-semibold tracking-tight',
                  active ? 'text-[--primary]' : 'text-[--fg-subtle]'
                )}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
