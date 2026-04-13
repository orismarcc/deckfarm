'use client'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white w-full max-h-[92vh] overflow-y-auto z-10',
        'rounded-t-2xl sm:rounded-2xl shadow-xl',
        { 'sm:max-w-sm': size === 'sm', 'sm:max-w-lg': size === 'md', 'sm:max-w-2xl': size === 'lg' }
      )}>
        {/* Handle bar on mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[--borda]" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--borda]">
          <h2 className="font-semibold text-[--fg] text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[--bg-dark] transition-colors text-[--fg-subtle] hover:text-[--fg]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
