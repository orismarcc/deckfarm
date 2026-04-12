import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 rounded-lg border text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition',
            error ? 'border-red-400' : 'border-gray-300',
            className
          )}
          {...props}
        />
        {hint && !error && <span className="text-xs text-gray-500">{hint}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }
)
Input.displayName = 'Input'
