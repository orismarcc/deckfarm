import { cn } from '@/lib/utils'
import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const taId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={taId} className="text-xs font-semibold text-[--fg-muted] uppercase tracking-wide">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          className={cn(
            'w-full rounded-xl border bg-white text-sm text-[--fg] transition-all duration-150 resize-none',
            'px-3 py-2.5 placeholder:text-[--fg-subtle]',
            'focus:outline-none focus:ring-2 focus:ring-[--primary]/30 focus:border-[--primary]',
            error ? 'border-red-400' : 'border-[--borda] hover:border-[--fg-subtle]/50',
            className
          )}
          rows={3}
          {...props}
        />
        {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
