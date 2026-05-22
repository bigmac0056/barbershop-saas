import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, Calendar, Scissors, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'
import { formatPrice, formatDuration } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Appointment } from '@/types'

export function SuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const appointmentId = params.get('id')
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!appointmentId) return
    api.getAppointment(appointmentId)
      .then((data) => setAppointment(data))
      .catch(() => setAppointment(null))
      .finally(() => setLoading(false))
  }, [appointmentId])

  if (loading) return <PageSpinner />

  if (!appointment) {
    return (
      <div className="min-h-svh flex items-center justify-center px-4">
        <p className="text-muted">Запись не найдена</p>
      </div>
    )
  }

  const startsAt = parseISO(appointment.starts_at)

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-4 max-w-lg mx-auto py-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1816]">Вы записаны!</h1>
        <p className="text-muted mt-2">Ждём вас в BarberDom</p>
      </div>

      <div className="w-full bg-surface rounded-2xl border border-border p-5 flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Дата и время</p>
            <p className="text-[#1A1816] font-semibold">
              {format(startsAt, 'd MMMM, EEEE', { locale: ru })} в {format(startsAt, 'HH:mm')}
            </p>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <Scissors className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Услуга</p>
            <p className="text-[#1A1816] font-semibold">
              {appointment.services?.name} · {formatDuration(appointment.services?.duration_min ?? 0)} · {formatPrice(appointment.services?.price ?? 0)}
            </p>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Мастер</p>
            <p className="text-[#1A1816] font-semibold">{appointment.employees?.name}</p>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Клиент</p>
            <p className="text-[#1A1816] font-semibold">{appointment.clients?.name}</p>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col gap-3">
        <Button variant="danger" fullWidth onClick={() => navigate(`/cancel?id=${appointment.id}`)}>
          Отменить запись
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
          На главную
        </Button>
      </div>
    </div>
  )
}
