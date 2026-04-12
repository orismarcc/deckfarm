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
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={taId} className="text-sm font-medium text-gray-700">{label}</label>}
        <textarea
          ref={ref}
          id={taId}
          className={cn(
            'w-full px-3 py-2 rounded-lg border text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none',
            error ? 'border-red-400' : 'border-gray-300',
            className
          )}
          rows={3}
          {...props}
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
