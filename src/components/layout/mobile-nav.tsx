'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MapPin, FlaskConical, CalendarDays, BarChart3 } from 'lucide-react'

// Bottom nav — alertas disponível no botão de sino no header superior
const nav = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Início'    },
  { href: '/fazendas',   icon: MapPin,           label: 'Fazendas'  },
  { href: '/aplicacoes', icon: FlaskConical,     label: 'Aplicar'   },
  { href: '/cronograma', icon: CalendarDays,     label: 'Agenda'    },
  { href: '/analytics',  icon: BarChart3,        label: 'Analytics' },
]

export function MobileNav() {
  const pathname  = usePathname()
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div
        className="mx-3 mb-1.5 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 10px 40px -4px rgba(0,0,0,0.15), 0 0 0 1px var(--borda)',
        }}
      >
        <div className="flex">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-all duration-150"
                style={{ color: active ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)' }}
              >
                <div
                  className="w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-150"
                  style={{ background: active ? 'hsl(160 84% 22% / 0.10)' : 'transparent' }}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <span
                  className="text-[10px] font-semibold tracking-tight"
                  style={{ color: active ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)' }}
                >
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
