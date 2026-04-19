'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import {
  LayoutDashboard, MapPin, Leaf, FlaskConical, CalendarDays,
  Bell, ClipboardList, Droplets, Settings, LogOut, Sprout, X,
  ChevronRight,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',      sub: 'Visão geral da operação' },
      { href: '/fazendas',   icon: MapPin,           label: 'Fazendas',       sub: 'Suas propriedades' },
      { href: '/talhoes',    icon: Leaf,             label: 'Talhões',        sub: 'Gestão de áreas' },
    ],
  },
  {
    label: 'Operações',
    items: [
      { href: '/aplicacoes',    icon: FlaskConical,  label: 'Aplicações',    sub: 'Histórico de aplicações' },
      { href: '/cronograma',    icon: CalendarDays,  label: 'Cronograma',    sub: 'Planejamento' },
      { href: '/recomendacoes', icon: ClipboardList, label: 'Recomendações', sub: 'Técnico agrônomo' },
      { href: '/calda',         icon: Droplets,      label: 'Calda',         sub: 'Cálculo de volume' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/alertas', icon: Bell,     label: 'Alertas', sub: 'Notificações' },
      { href: '/perfil',  icon: Settings, label: 'Perfil',  sub: 'Minha conta' },
    ],
  },
]

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname   = usePathname()
  const { user, logout } = useAuthStore()
  const { isOnline, notificacoes } = useAppStore()
  const unread     = notificacoes.filter(n => !n.lida).length
  const drawerRef  = useRef<HTMLDivElement>(null)
  const initials   = user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  // Fecha ao pressionar Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Trava scroll do body quando aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Fecha ao clicar fora
  function handleBackdropClick(e: React.MouseEvent) {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  function handleLogout() {
    logout()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="md:hidden fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="md:hidden fixed top-0 left-0 bottom-0 z-50 flex flex-col w-[300px] max-w-[85vw]"
        style={{
          background: 'var(--sidebar-bg, hsl(160 30% 8%))',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
          boxShadow: open ? '4px 0 32px rgba(0,0,0,0.4)' : 'none',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        {/* Esferas decorativas */}
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/[0.02] pointer-events-none" />
        <div className="absolute bottom-32 -left-8 w-28 h-28 rounded-full bg-white/[0.015] pointer-events-none" />

        {/* ── Header do drawer ── */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.12)]">
              <Sprout className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-white font-bold text-[14px] tracking-tight leading-none">DeckFarm</div>
              <div className="text-white/25 text-[9px] tracking-widest uppercase mt-0.5">Gestão Agrícola</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Perfil resumido ── */}
        <Link
          href="/perfil"
          onClick={onClose}
          className="relative z-10 mx-3 mb-3 flex items-center gap-3 px-3 py-3 rounded-xl transition-colors group"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        >
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center text-emerald-300 text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white/85 truncate">{user?.apelido || user?.nome}</div>
            <div className="text-[10px] text-white/30 truncate">{user?.email}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Online indicator */}
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: isOnline ? '#34d399' : '#f87171', boxShadow: isOnline ? '0 0 5px #34d399' : 'none' }}
              title={isOnline ? 'Online' : 'Offline'}
            />
            <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
          </div>
        </Link>

        {/* ── Nav ── */}
        <nav className="relative z-10 flex-1 overflow-y-auto px-3 pb-3 space-y-4 scrollbar-hide">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {/* Label do grupo */}
              <div className="px-2 mb-1.5 text-[9px] font-bold tracking-[0.12em] uppercase text-white/20">
                {group.label}
              </div>

              {/* Items */}
              <div className="space-y-0.5">
                {group.items.map(({ href, icon: Icon, label, sub }) => {
                  const active    = pathname.startsWith(href)
                  const isAlertas = href === '/alertas'

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                    >
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative ${
                        active
                          ? 'bg-white/10 border border-white/10'
                          : 'border border-transparent hover:bg-white/5'
                      }`}>
                        {/* Barra de ativo */}
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        )}

                        {/* Ícone */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          active ? 'bg-emerald-500/20' : 'bg-white/5'
                        }`}>
                          <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-white/45'}`} />
                        </div>

                        {/* Texto */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-semibold leading-none truncate ${
                            active ? 'text-white' : 'text-white/55'
                          }`}>
                            {label}
                          </div>
                          <div className="text-[10px] text-white/20 mt-0.5 truncate">{sub}</div>
                        </div>

                        {/* Badge alertas */}
                        {isAlertas && unread > 0 && (
                          <span className="text-[8px] font-bold bg-red-500/25 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer: sair ── */}
        <div className="relative z-10 px-3 py-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group text-left border border-transparent hover:bg-red-500/10 hover:border-red-500/20"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-red-500/15 flex items-center justify-center flex-shrink-0 transition-colors">
              <LogOut className="w-4 h-4 text-white/35 group-hover:text-red-400 transition-colors" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white/40 group-hover:text-red-400 transition-colors leading-none">
                Sair da conta
              </div>
              <div className="text-[10px] text-white/20 mt-0.5">{user?.email}</div>
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
