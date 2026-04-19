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

  // Fecha com Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Trava scroll do body
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Recalcula altura quando o teclado virtual abre (iOS / Android)
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return

    function adjust() {
      if (!panelRef.current || !vv) return
      // Deixa 12px de respiro no topo; o painel não excede o viewport visual
      const available = Math.min(vv.height - 12, window.innerHeight * 0.95)
      panelRef.current.style.maxHeight = `${Math.max(available, 200)}px`
    }

    vv.addEventListener('resize', adjust)
    vv.addEventListener('scroll', adjust)
    adjust()
    return () => {
      vv.removeEventListener('resize', adjust)
      vv.removeEventListener('scroll', adjust)
    }
  }, [open])

  if (!open) return null

  return (
    /*
     * z-[70]: acima do bottom nav (z-50) e do hamburger drawer (z-50).
     * O modal cobre TODA a tela — comportamento padrão em mobile.
     *
     * Mobile  (<sm): items-end → bottom sheet que sobe da base.
     * Desktop (≥sm): items-center → modal centralizado com padding.
     */
    <div
      className={cn(
        'fixed inset-0 z-[70] flex justify-center',
        'items-end',          // mobile: bottom sheet
        'sm:items-center sm:p-4', // desktop: centralizado
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Painel */}
      <div
        ref={panelRef}
        className={cn(
          'relative flex flex-col w-full z-10',
          'rounded-t-2xl sm:rounded-2xl shadow-xl',
          {
            'sm:max-w-sm':  size === 'sm',
            'sm:max-w-lg':  size === 'md',
            'sm:max-w-2xl': size === 'lg',
          }
        )}
        style={{
          background: 'var(--bg-card)',
          // Mobile: até 92% da tela. Desktop: 88vh.
          maxHeight: 'min(92dvh, 92vh)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0 rounded-t-2xl"
          style={{ borderBottom: '1px solid var(--borda)', background: 'var(--bg-card)' }}
        >
          <h2 className="font-semibold text-base" style={{ color: 'var(--fg)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--fg-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Corpo com scroll ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 min-h-0">
          {children}
        </div>

        {/* ── Footer — nunca escondido ──
            padding-bottom usa env(safe-area-inset-bottom) para respeitar
            o "home indicator" do iPhone e garantir que os botões ficam
            sempre acessíveis (nenhum elemento fica atrás do sistema). */}
        {footer && (
          <div
            className="flex-shrink-0 px-5 pt-3 sm:rounded-b-2xl"
            style={{
              borderTop: '1px solid var(--borda)',
              background: 'var(--bg-card)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
