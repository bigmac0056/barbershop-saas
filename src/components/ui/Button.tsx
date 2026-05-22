import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-gold text-white hover:bg-gold-hover active:scale-[0.98] shadow-sm': variant === 'primary',
            'bg-transparent text-[#1A1816] hover:bg-surface-2 active:scale-[0.98]': variant === 'ghost',
            'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30': variant === 'danger',
            'bg-transparent border border-border text-[#1A1816] hover:border-gold/60 hover:bg-surface': variant === 'outline',
          },
          {
            'px-3 py-2 text-sm min-h-[36px]': size === 'sm',
            'px-4 py-3 text-sm min-h-[48px]': size === 'md',
            'px-6 py-4 text-base min-h-[56px]': size === 'lg',
          },
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {children}
          </span>
        ) : children}
      </button>
    )
  }
)
Button.displayName = 'Button'
