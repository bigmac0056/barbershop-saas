import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean
  hoverable?: boolean
}

export function Card({ className, selected, hoverable, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-2xl p-4 border border-border transition-all duration-200',
        hoverable && 'cursor-pointer hover:border-gold/40 hover:shadow-sm active:scale-[0.99]',
        selected && 'border-gold ring-2 ring-gold/25 bg-gold/5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
