import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/types'

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending:   { label: 'Ожидает',      className: 'bg-amber-50  text-amber-700  border-amber-300' },
  confirmed: { label: 'Подтверждена', className: 'bg-blue-50   text-blue-700   border-blue-300' },
  completed: { label: 'Выполнена',    className: 'bg-green-50  text-green-700  border-green-300' },
  cancelled: { label: 'Отменена',     className: 'bg-red-50    text-red-600    border-red-300' },
  no_show:   { label: 'Не пришёл',    className: 'bg-gray-100  text-gray-500   border-gray-300' },
}

interface StatusBadgeProps {
  status: AppointmentStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      config.className,
      className,
    )}>
      {config.label}
    </span>
  )
}
