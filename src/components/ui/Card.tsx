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
        'bg-surface rounded-2xl p-4 transition-all duration-200',
        hoverable && 'cursor-pointer hover:bg-surface-2 active:scale-[0.99]',
        selected && 'ring-2 ring-gold bg-surface-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
