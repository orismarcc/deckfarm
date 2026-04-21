'use client'
import { useState } from 'react'
import { Bell, Sprout, Menu } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'
import { MobileDrawer } from './mobile-drawer'

export function Header({ title }: { title?: string }) {
  const { notificacoes } = useAppStore()
  const { user } = useAuthStore()
  const unread   = notificacoes.filter(n => !n.lida).length
  const initials = user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-3 py-2.5"
        style={{
          background: 'var(--header-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--borda)',
        }}
      >
        {/* Esquerda: hambúrguer + logo */}
        <div className="flex items-center gap-2">
          {/* Botão hambúrguer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
            style={{ color: 'var(--fg-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />

            {/* Ponto de notificação no hambúrguer quando há alertas */}
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white/80" />
            )}
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: 'hsl(160 84% 22%)' }}
            >
              <Sprout className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="font-semibold text-[14px] tracking-tight"
              style={{ color: 'var(--fg)' }}
            >
              {title || 'DeckFarm'}
            </span>
          </div>
        </div>

        {/* Direita: alertas + avatar */}
        <div className="flex items-center gap-0.5">
          {/* Alertas */}
          <Link
            href="/alertas"
            className="relative p-2 rounded-xl transition-colors"
            style={{ color: 'var(--fg-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            aria-label="Alertas"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          {/* Avatar / Perfil */}
          <Link
            href="/perfil"
            className="p-1 rounded-xl transition-colors"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            aria-label="Meu perfil"
          >
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[12px] font-bold flex-shrink-0"
              style={{
                background: user?.avatar ? 'transparent' : 'hsl(160 84% 22% / 0.12)',
                border: '1.5px solid hsl(160 84% 22% / 0.3)',
                color: 'hsl(160 84% 22%)',
              }}
            >
              {user?.avatar
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                : initials
              }
            </div>
          </Link>
        </div>
      </header>

      {/* Drawer de navegação */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
