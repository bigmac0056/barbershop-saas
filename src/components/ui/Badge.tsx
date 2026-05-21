import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/types'

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending:   { label: 'Ожидает',     className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  confirmed: { label: 'Подтверждена', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  completed: { label: 'Выполнена',   className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  cancelled: { label: 'Отменена',    className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  no_show:   { label: 'Не пришёл',   className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
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
