import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Appointment, AppointmentStatus } from '@/types'

export function useAppointments(date?: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setAppointments(await api.getAppointments(date))
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { refresh() }, [refresh])

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    await api.updateStatus(id, status)
    await refresh()
  }

  return { appointments, loading, refresh, updateStatus }
}
