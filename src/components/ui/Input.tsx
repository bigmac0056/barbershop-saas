import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[#D1D5DB]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-surface border border-[#333] rounded-xl px-4 py-3 text-[#F5F5F5]',
            'placeholder:text-muted text-base',
            'focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30',
            'transition-colors duration-200',
            error && 'border-danger/60 focus:border-danger/80 focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
