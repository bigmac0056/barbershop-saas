import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

interface Props {
  slots: string[]
  selected: string | null
  loading: boolean
  onSelect: (slot: string) => void
}

export function TimeSlots({ slots, selected, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        <p>Нет свободных слотов на эту дату</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {slots.map((slot) => (
        <button
          key={slot}
          onClick={() => onSelect(slot)}
          className={cn(
            'py-3 rounded-xl text-sm font-medium transition-all duration-200',
            'min-h-[48px]',
            selected === slot
              ? 'bg-gold text-black'
              : 'bg-surface text-[#F5F5F5] hover:bg-surface-2',
          )}
        >
          {slot}
        </button>
      ))}
    </div>
  )
}
