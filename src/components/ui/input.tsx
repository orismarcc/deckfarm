import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-[--fg-muted] uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--fg-subtle] pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-10 w-full rounded-xl border bg-white text-sm text-[--fg] transition-all duration-150',
              'placeholder:text-[--fg-subtle]',
              'focus:outline-none focus:ring-2 focus:ring-[--primary]/30 focus:border-[--primary]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-red-400 focus:ring-red-400/20' : 'border-[--borda] hover:border-[--fg-subtle]/50',
              icon ? 'pl-9 pr-3' : 'px-3',
              className
            )}
            {...props}
          />
        </div>
        {hint && !error && <span className="text-xs text-[--fg-subtle]">{hint}</span>}
        {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
