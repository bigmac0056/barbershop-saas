import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useServices } from '@/hooks/useServices'
import { useEmployees } from '@/hooks/useEmployees'
import { useAvailableSlots } from '@/hooks/useAvailableSlots'
import { api } from '@/lib/api'
import { formatPhone, normalizePhone, formatDuration, formatPrice } from '@/lib/utils'
import { format, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  defaultEmployeeId?: string
  defaultDate?: string
  defaultTime?: string
  onClose: () => void
  onCreated: () => void
}

export function AddAppointmentModal({ open, defaultEmployeeId, defaultDate, defaultTime, onClose, onCreated }: Props) {
  const { services } = useServices()
  const { employees } = useEmployees()

  const [serviceId, setServiceId] = useState(defaultEmployeeId ?? '')
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? '')
  const [date, setDate] = useState(defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState(defaultTime ?? '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { slots, loading: slotsLoading } = useAvailableSlots(
    employeeId || null,
    date || null,
    serviceId || null,
  )

  // Sync defaults when modal opens
  useEffect(() => {
    if (open) {
      setEmployeeId(defaultEmployeeId ?? '')
      setDate(defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
      setTime(defaultTime ?? '')
      setError('')
    }
  }, [open, defaultEmployeeId, defaultDate, defaultTime])

  // Reset time if slots change and current time no longer available
  useEffect(() => {
    if (time && slots.length > 0 && !slots.includes(time)) setTime('')
  }, [slots, time])

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i)
    return format(d, 'yyyy-MM-dd')
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!serviceId || !employeeId || !date || !time || name.trim().length < 2) {
      setError('Заполните все поля')
      return
    }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Введите полный номер телефона')
      return
    }

    setLoading(true)
    try {
      await api.createAppointment({
        service_id: serviceId,
        employee_id: employeeId,
        date,
        time,
        client_name: name.trim(),
        client_phone: normalizePhone(phone),
        notes: notes.trim() || undefined,
      })
      onCreated()
      onClose()
      resetForm()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при создании записи')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setServiceId(''); setEmployeeId(''); setTime('')
    setName(''); setPhone(''); setNotes(''); setError('')
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl max-h-[92svh] overflow-y-auto max-w-lg mx-auto border-t border-border">
        {/* Handle */}
        <div className="sticky top-0 bg-background pt-3 pb-2 px-5 flex items-center justify-between border-b border-border">
          <div className="w-10 h-1 bg-border rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <h2 className="text-base font-bold text-[#1A1816] mt-3">Новая запись</h2>
          <button onClick={onClose} className="mt-3 p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-[#4A4540] mb-2">Услуга</label>
            <div className="flex flex-col gap-2">
              {services.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => { setServiceId(s.id); setTime('') }}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                    serviceId === s.id
                      ? 'border-gold bg-gold/10 text-[#1A1816]'
                      : 'border-border bg-surface text-[#1A1816] hover:border-gold/40',
                  )}
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-muted">{formatDuration(s.duration_min)} · {formatPrice(s.price)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-[#4A4540] mb-2">Мастер</label>
            <div className="grid grid-cols-2 gap-2">
              {employees.map((emp) => (
                <button
                  type="button"
                  key={emp.id}
                  onClick={() => { setEmployeeId(emp.id); setTime('') }}
                  className={cn(
                    'px-3 py-3 rounded-xl border text-sm font-medium transition-all',
                    employeeId === emp.id
                      ? 'border-gold bg-gold/10 text-[#1A1816]'
                      : 'border-border bg-surface text-[#1A1816] hover:border-gold/40',
                  )}
                >
                  {emp.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[#4A4540] mb-2">Дата</label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
              {days.map((d) => {
                const isToday = d === format(new Date(), 'yyyy-MM-dd')
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => { setDate(d); setTime('') }}
                    className={cn(
                      'shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-all min-w-[52px]',
                      date === d
                        ? 'bg-gold border-gold text-white'
                        : 'bg-surface border-border text-[#1A1816] hover:border-gold/40',
                    )}
                  >
                    <span className={cn('text-xs', date === d ? 'text-white/70' : 'text-muted')}>
                      {isToday ? 'Сег' : format(new Date(d), 'EE', { locale: { code: 'ru' } as never }).slice(0, 2)}
                    </span>
                    <span className="text-base font-bold">{format(new Date(d + 'T12:00:00'), 'd')}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          {serviceId && employeeId && (
            <div>
              <label className="block text-sm font-medium text-[#4A4540] mb-2">Время</label>
              {slotsLoading ? (
                <p className="text-xs text-muted">Загрузка слотов...</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-muted">Нет свободных слотов на эту дату</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setTime(slot)}
                      className={cn(
                        'py-2.5 rounded-xl border text-sm font-medium transition-all',
                        time === slot
                          ? 'bg-gold border-gold text-white'
                          : 'bg-surface border-border text-[#1A1816] hover:border-gold/40',
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Client info */}
          <div className="flex flex-col gap-3">
            <Input
              label="Имя клиента"
              placeholder="Алибек"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <Input
              label="Телефон"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
            />
            <Input
              label="Заметка (необязательно)"
              placeholder="Постоянный клиент, любит фейд..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" size="lg" fullWidth loading={loading} className="mb-2">
            Создать запись
          </Button>
        </form>
      </div>
    </>
  )
}
