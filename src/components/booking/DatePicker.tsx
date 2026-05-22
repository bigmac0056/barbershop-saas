import { format, addDays, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Props {
  selected: string | null
  onSelect: (date: string) => void
  daysCount?: number
}

export function DatePicker({ selected, onSelect, daysCount = 14 }: Props) {
  const today = startOfDay(new Date())
  const days = Array.from({ length: daysCount }, (_, i) => addDays(today, i))

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
      {days.map((day) => {
        const iso = format(day, 'yyyy-MM-dd')
        const isSelected = selected ? isSameDay(parseISO(selected), day) : false
        const isToday = isSameDay(day, today)

        return (
          <button
            key={iso}
            onClick={() => onSelect(iso)}
            className={cn(
              'flex flex-col items-center justify-center shrink-0',
              'w-14 h-16 rounded-xl transition-all duration-200 border',
              isSelected
                ? 'bg-gold border-gold text-white shadow-sm'
                : 'bg-surface border-border text-[#1A1816] hover:border-gold/40',
            )}
          >
            <span className={cn('text-xs uppercase', isSelected ? 'text-white/80' : 'text-muted')}>
              {isToday ? 'Сег' : format(day, 'EEE', { locale: ru }).slice(0, 2)}
            </span>
            <span className="text-xl font-bold leading-tight">{format(day, 'd')}</span>
            <span className={cn('text-xs', isSelected ? 'text-white/70' : 'text-muted')}>
              {format(day, 'MMM', { locale: ru })}
            </span>
          </button>
        )
      })}
    </div>
  )
}
