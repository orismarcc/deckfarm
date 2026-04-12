'use client'
import { Bell, Menu, Sprout } from 'lucide-react'
import { useAppStore } from '@/store/app'
import Link from 'next/link'

export function Header({ title }: { title?: string }) {
  const { notificacoes } = useAppStore()
  const unread = notificacoes.filter(n => !n.lida).length

  return (
    <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
          <Sprout className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">{title || 'DeckFarm'}</span>
      </div>
      <Link href="/alertas" className="relative p-2">
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </header>
  )
}
