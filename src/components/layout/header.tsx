'use client'
import { Bell, Sprout, UserCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useAuthStore } from '@/store/auth'
import Link from 'next/link'

export function Header({ title }: { title?: string }) {
  const { notificacoes } = useAppStore()
  const { user } = useAuthStore()
  const unread = notificacoes.filter(n => !n.lida).length
  const initials = user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--borda)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: 'hsl(160 84% 22%)' }}>
          <Sprout className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight" style={{ color: 'var(--fg)' }}>
          {title || 'DeckFarm'}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Alertas */}
        <Link href="/alertas" className="relative p-2 rounded-xl transition-colors"
          style={{ color: 'var(--fg-muted)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        {/* Perfil */}
        <Link href="/perfil" className="p-1 rounded-xl transition-colors"
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title="Meu perfil"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
            style={{
              background: 'hsl(160 84% 22% / 0.12)',
              border: '1.5px solid hsl(160 84% 22% / 0.25)',
              color: 'hsl(160 84% 22%)',
            }}
          >
            {initials}
          </div>
        </Link>
      </div>
    </header>
  )
}
