import { Scissors, Gem, Star } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { useServices } from '@/hooks/useServices'
import { formatPrice, formatDuration } from '@/lib/utils'
import type { Service } from '@/types'

const icons = [Scissors, Gem, Star]

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
        return (
          <Card
            key={service.id}
            selected={selected?.id === service.id}
            hoverable
            onClick={() => onSelect(service)}
            className="flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-[#F5F5F5]">{service.name}</p>
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
