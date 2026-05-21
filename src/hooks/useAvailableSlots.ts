import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export function useAvailableSlots(
  employeeId: string | null,
  date: string | null,
  serviceId: string | null,
) {
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!employeeId || !date || !serviceId) {
      setSlots([])
      return
    }
    setLoading(true)
    api.getSlots(employeeId, date, serviceId)
      .then(({ slots }) => setSlots(slots))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false))
  }, [employeeId, date, serviceId])

  return { slots, loading }
}
