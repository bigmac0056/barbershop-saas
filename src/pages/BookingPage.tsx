import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { ServiceSelect } from '@/components/booking/ServiceSelect'
import { EmployeeSelect } from '@/components/booking/EmployeeSelect'
import { DatePicker } from '@/components/booking/DatePicker'
import { TimeSlots } from '@/components/booking/TimeSlots'
import { ContactForm } from '@/components/booking/ContactForm'
import { Button } from '@/components/ui/Button'
import { useAvailableSlots } from '@/hooks/useAvailableSlots'
import { api } from '@/lib/api'
import type { BookingState } from '@/types'

const STEPS = ['Услуга', 'Мастер', 'Дата и время', 'Контакты']

export function BookingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [booking, setBooking] = useState<BookingState>({
    service: null,
    employee: null,
    date: null,
    timeSlot: null,
    clientName: '',
    clientPhone: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const { slots, loading: slotsLoading } = useAvailableSlots(
    booking.employee?.id ?? null,
    booking.date,
    booking.service?.id ?? null,
  )

  const canGoNext = () => {
    if (step === 0) return booking.service !== null
    if (step === 1) return booking.employee !== null
    if (step === 2) return booking.date !== null && booking.timeSlot !== null
    return false
  }

  const goNext = () => { if (step < STEPS.length - 1) setStep(step + 1) }
  const goBack = () => { if (step > 0) setStep(step - 1); else navigate('/') }

  const handleSubmit = async (name: string, phone: string) => {
    if (!booking.service || !booking.employee || !booking.date || !booking.timeSlot) return
    setSubmitting(true)
    try {
      const data = await api.createAppointment({
        service_id: booking.service.id,
        employee_id: booking.employee.id,
        date: booking.date,
        time: booking.timeSlot,
        client_name: name,
        client_phone: phone,
      })
      navigate(`/success?id=${data.appointment_id}`)
    } catch {
      alert('Не удалось создать запись. Попробуйте снова.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-surface-2 transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#1A1816]" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted">Шаг {step + 1} из {STEPS.length}</p>
            <h1 className="text-base font-semibold text-[#1A1816]">{STEPS[step]}</h1>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5">
        {/* Summary chips */}
        {step > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {booking.service && (
              <span className="text-xs px-3 py-1 bg-gold/10 text-gold rounded-full border border-gold/20 font-medium">
                {booking.service.name}
              </span>
            )}
            {booking.employee && (
              <span className="text-xs px-3 py-1 bg-surface border border-border rounded-full text-[#4A4540]">
                {booking.employee.name}
              </span>
            )}
            {booking.date && (
              <span className="text-xs px-3 py-1 bg-surface border border-border rounded-full text-[#4A4540]">
                {booking.date}
              </span>
            )}
            {booking.timeSlot && (
              <span className="text-xs px-3 py-1 bg-surface border border-border rounded-full text-[#4A4540]">
                {booking.timeSlot}
              </span>
            )}
          </div>
        )}

        {step === 0 && (
          <ServiceSelect
            selected={booking.service}
            onSelect={(s) => setBooking({ ...booking, service: s, employee: null, timeSlot: null })}
          />
        )}
        {step === 1 && booking.service && (
          <EmployeeSelect
            serviceId={booking.service.id}
            selected={booking.employee}
            onSelect={(e) => setBooking({ ...booking, employee: e, timeSlot: null })}
          />
        )}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <DatePicker
              selected={booking.date}
              onSelect={(d) => setBooking({ ...booking, date: d, timeSlot: null })}
            />
            {booking.date && (
              <div>
                <p className="text-sm text-muted mb-3">Свободное время</p>
                <TimeSlots
                  slots={slots}
                  selected={booking.timeSlot}
                  loading={slotsLoading}
                  onSelect={(t) => setBooking({ ...booking, timeSlot: t })}
                />
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <ContactForm onSubmit={handleSubmit} loading={submitting} />
        )}
      </div>

      {/* Next button */}
      {step < 3 && (
        <div className="sticky bottom-0 px-4 pb-6 pt-3 bg-gradient-to-t from-background to-transparent safe-bottom">
          <Button size="lg" fullWidth disabled={!canGoNext()} onClick={goNext}>
            Далее
          </Button>
        </div>
      )}
    </div>
  )
}
