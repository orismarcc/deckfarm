'use client'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  /* Ajusta altura do modal quando o teclado virtual abre (iOS/Android) */
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    function adjust() {
      if (!panelRef.current) return
      const available = vv!.height
      panelRef.current.style.maxHeight = `${available * 0.92}px`
    }
    vv.addEventListener('resize', adjust)
    adjust()
    return () => vv.removeEventListener('resize', adjust)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          'relative flex flex-col w-full z-10',
          'rounded-2xl shadow-xl',
          'max-h-[88vh]',
          {
            'max-w-sm':  size === 'sm',
            'max-w-lg':  size === 'md',
            'max-w-2xl': size === 'lg',
          }
        )}
        style={{ background: 'var(--bg-card)' }}
      >
        {/* Header — sempre visível */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0 rounded-t-2xl"
          style={{ borderBottom: '1px solid var(--borda)', background: 'var(--bg-card)' }}
        >
          <h2 className="font-semibold text-base" style={{ color: 'var(--fg)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--fg-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {children}
        </div>

        {/* Footer — sempre visível */}
        {footer && (
          <div
            className="flex-shrink-0 px-5 pb-5 pt-3 rounded-b-2xl"
            style={{ borderTop: '1px solid var(--borda)', background: 'var(--bg-card)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
