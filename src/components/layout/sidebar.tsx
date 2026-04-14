'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { LayoutDashboard, MapPin, Leaf, FlaskConical, CalendarDays, Bell, LogOut, Sprout, Settings } from 'lucide-react'

const nav = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   sub: 'Visão geral' },
  { href: '/fazendas',   icon: MapPin,           label: 'Fazendas',    sub: 'Suas propriedades' },
  { href: '/talhoes',    icon: Leaf,             label: 'Talhões',     sub: 'Gestão de áreas' },
  { href: '/aplicacoes', icon: FlaskConical,     label: 'Aplicações',  sub: 'Histórico' },
  { href: '/cronograma', icon: CalendarDays,     label: 'Cronograma',  sub: 'Planejamento' },
  { href: '/alertas',    icon: Bell,             label: 'Alertas',     sub: 'Notificações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { isOnline, notificacoes } = useAppStore()
  const unread = notificacoes.filter(n => !n.lida).length

  return (
    <aside className="sidebar grain hidden md:flex flex-col w-[260px] h-full flex-shrink-0 relative overflow-hidden">
      {/* Decorative organic circles */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/[0.03] pointer-events-none" />
      <div className="absolute top-32 -left-10 w-32 h-32 rounded-full bg-white/[0.02] pointer-events-none" />
      <div className="absolute bottom-40 right-4 w-20 h-20 rounded-full bg-white/[0.015] pointer-events-none" />

      {/* Logo */}
      <div className="relative z-10 px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
            <Sprout className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] tracking-tight leading-none">DeckFarm</div>
            <div className="text-white/25 text-[10px] tracking-widest uppercase mt-0.5">Gestão Agrícola</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 px-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label, sub }, i) => {
          const active = pathname.startsWith(href)
          const isAlertas = href === '/alertas'
          return (
            <Link
              key={href}
              href={href}
              style={{ animationDelay: `${i * 60}ms` }}
              className="block animate-fade-in-left"
            >
              <div className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                active
                  ? 'bg-white/10 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'hover:bg-white/5 border border-transparent'
              )}>
                {/* Left accent bar */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                )}

                {/* Icon */}
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200',
                  active
                    ? 'bg-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]'
                    : 'bg-white/5 group-hover:bg-white/8'
                )}>
                  <Icon className={cn('w-4 h-4 transition-colors', active ? 'text-emerald-400' : 'text-white/50 group-hover:text-white/70')} />
                </div>

                {/* Labels */}
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[13px] font-semibold leading-none truncate transition-colors', active ? 'text-white' : 'text-white/55 group-hover:text-white/75')}>
                    {label}
                  </div>
                  <div className="text-[10px] text-white/20 mt-0.5 truncate">{sub}</div>
                </div>

                {/* Badge */}
                {isAlertas && unread > 0 && (
                  <span className="text-[8px] font-bold bg-red-500/25 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="relative z-10 mx-5 my-3 h-px bg-white/6" />

      {/* Online status */}
      <div className="relative z-10 px-5 pb-3">
        <div className="flex items-center gap-1.5 text-[10px] text-white/20">
          {isOnline ? (
            <>
              <div
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                style={{ boxShadow: '0 0 6px #34d399' }}
              />
              <span>Sincronizado</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Offline</span>
            </>
          )}
        </div>
      </div>

      {/* User footer */}
      <div className="relative z-10 px-4 py-4 border-t border-white/5">
        <Link href="/perfil" className="flex items-center gap-2.5 group mb-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center text-emerald-300 text-sm font-bold flex-shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
            {user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white/80 truncate">{user?.apelido || user?.nome}</div>
            <div className="text-[10px] text-white/25 truncate">{user?.email}</div>
          </div>
          <Settings className="w-3.5 h-3.5 text-white/25 group-hover:text-white/50 transition-colors flex-shrink-0" />
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/8 transition-colors group text-left"
          title="Sair"
        >
          <LogOut className="w-3.5 h-3.5 text-white/25 group-hover:text-red-400 transition-colors flex-shrink-0" />
          <span className="text-[11px] text-white/25 group-hover:text-white/50 transition-colors">Sair da conta</span>
        </button>
      </div>
    </aside>
  )
}
