import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Service } from '@/types'

export function useServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getServices()
      .then((data) => setServices(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { services, loading, error }
}
