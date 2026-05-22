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
            'py-3 rounded-xl text-sm font-medium transition-all duration-200 border',
            'min-h-[48px]',
            selected === slot
              ? 'bg-gold border-gold text-white shadow-sm'
              : 'bg-surface border-border text-[#1A1816] hover:border-gold/40',
          )}
        >
          {slot}
        </button>
      ))}
    </div>
  )
}
