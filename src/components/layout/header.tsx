'use client'
import { Bell, Sprout } from 'lucide-react'
import { useAppStore } from '@/store/app'
import Link from 'next/link'

export function Header({ title }: { title?: string }) {
  const { notificacoes } = useAppStore()
  const unread = notificacoes.filter(n => !n.lida).length

  return (
    <header className="md:hidden bg-white/80 backdrop-blur-sm border-b border-[--borda] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-[--primary] rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(var(--primary-rgb),0.35)]">
          <Sprout className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[--fg] text-[15px] tracking-tight">
          {title || 'DeckFarm'}
        </span>
      </div>
      <Link
        href="/alertas"
        className="relative p-1.5 rounded-lg hover:bg-[--bg-dark] transition-colors"
      >
        <Bell className="w-5 h-5 text-[--fg-muted]" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </header>
  )
}
