import { Scissors, Sparkles, Droplets, Zap, Wind, Star } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { useServices } from '@/hooks/useServices'
import { formatPrice, formatDuration } from '@/lib/utils'
import type { Service } from '@/types'

const icons = [Scissors, Star, Sparkles, Zap, Droplets, Wind]

interface Props {
  selected: Service | null
  onSelect: (service: Service) => void
}

export function ServiceSelect({ selected, onSelect }: Props) {
  const { services, loading } = useServices()

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-3">
      {services.map((service, i) => {
        const Icon = icons[i % icons.length]
        const isSelected = selected?.id === service.id
        return (
          <Card
            key={service.id}
            selected={isSelected}
            hoverable
            onClick={() => onSelect(service)}
            className="flex items-center gap-4"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-gold text-white' : 'bg-gold/10 text-gold'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-[#1A1816]">{service.name}</p>
              <p className="text-sm text-muted mt-0.5">{formatDuration(service.duration_min)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-gold text-lg">{formatPrice(service.price)}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
