import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Employee } from '@/types'

export function useEmployees(serviceId?: string) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getEmployees(serviceId)
      .then((data) => setEmployees(data))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [serviceId])

  return { employees, loading }
}
