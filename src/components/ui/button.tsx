import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, CSSProperties, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'amber'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    const variantStyle: CSSProperties = {}
    if (variant === 'primary') {
      variantStyle.background = 'hsl(160 84% 22%)'
      variantStyle.color = '#ffffff'
      variantStyle.boxShadow = '0 2px 8px rgba(10, 91, 50, 0.35)'
    } else if (variant === 'secondary') {
      variantStyle.background = 'var(--bg-dark)'
      variantStyle.color = 'var(--fg)'
      variantStyle.border = '1px solid var(--borda)'
    } else if (variant === 'ghost') {
      variantStyle.color = 'var(--fg-muted)'
    } else if (variant === 'outline') {
      variantStyle.border = '1px solid var(--borda)'
      variantStyle.background = 'var(--bg-card)'
      variantStyle.color = 'var(--fg)'
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none',
          {
            'hover:brightness-110 active:scale-[0.98]': variant === 'primary',
            'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm': variant === 'danger',
            'border border-amber-600/50 text-amber-700 bg-amber-50 hover:bg-amber-100 focus-visible:ring-amber-500': variant === 'amber',
            'hover:opacity-80': variant === 'secondary' || variant === 'ghost' || variant === 'outline',
          },
          {
            'h-7 px-3 text-xs rounded-md': size === 'sm',
            'h-9 px-4 text-sm': size === 'md',
            'h-11 px-6 text-sm': size === 'lg',
            'h-8 w-8 p-0 rounded-lg': size === 'icon',
          },
          className
        )}
        style={{ ...variantStyle, ...style }}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
