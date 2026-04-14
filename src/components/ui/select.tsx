import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-[--fg-muted] uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'h-10 w-full rounded-xl border text-sm text-[--fg] transition-all duration-150 appearance-none pr-8 pl-3',
              'focus:outline-none focus:ring-2 focus:ring-[--primary]/30 focus:border-[--primary]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-red-400' : 'border-[--borda] hover:border-[--fg-subtle]/50',
              className
            )}
            style={{ background: 'var(--input-bg)', ...props.style }}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[--fg-subtle] pointer-events-none" />
        </div>
        {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'
