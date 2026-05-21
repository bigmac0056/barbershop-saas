import { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format, addDays, subDays, parseISO, addWeeks, subWeeks, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import type { AdminContextType } from '@/components/admin/AdminLayout'
import { useAppointments } from '@/hooks/useAppointments'
import { useEmployees } from '@/hooks/useEmployees'
import { cn } from '@/lib/utils'
import type { Appointment, Employee } from '@/types'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 9) // 09:00 – 20:00

function getTop(startsAt: string): number {
  const d = parseISO(startsAt)
  return ((d.getHours() - 9) * 60 + d.getMinutes()) * (64 / 60)
}

function getHeight(startsAt: string, endsAt: string): number {
  const diff = (parseISO(endsAt).getTime() - parseISO(startsAt).getTime()) / 60000
  return Math.max(diff * (64 / 60), 32)
}

interface AppointmentBlockProps {
  apt: Appointment
  onClick: (apt: Appointment) => void
}

function AppointmentBlock({ apt, onClick }: AppointmentBlockProps) {
  const top = getTop(apt.starts_at)
  const height = getHeight(apt.starts_at, apt.ends_at)
  const time = format(parseISO(apt.starts_at), 'HH:mm')

  const colorMap: Record<string, string> = {
    pending:   'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    confirmed: 'bg-blue-500/20   border-blue-500/50   text-blue-300',
    completed: 'bg-green-500/20  border-green-500/50  text-green-300',
    cancelled: 'bg-zinc-700/40   border-zinc-600/50   text-zinc-400  opacity-50',
    no_show:   'bg-zinc-700/40   border-zinc-600/50   text-zinc-400  opacity-50',
  }

  return (
    <div
      className={cn(
        'absolute left-0.5 right-0.5 rounded-lg border px-2 py-1 cursor-pointer',
        'overflow-hidden transition-opacity hover:opacity-90 active:opacity-70',
        colorMap[apt.status] ?? 'bg-surface border-zinc-600 text-[#F5F5F5]',
      )}
      style={{ top, height }}
      onClick={() => onClick(apt)}
    >
      <p className="text-xs font-semibold leading-tight truncate">{time} {apt.clients?.name}</p>
      <p className="text-xs opacity-70 truncate">{apt.services?.name}</p>
    </div>
  )
}

interface DayViewProps {
  date?: string
  employees: Employee[]
  appointments: Appointment[]
  onClickApt: (apt: Appointment) => void
  onAddSlot: (employeeId: string, time: string) => void
}

function DayView({ employees, appointments, onClickApt, onAddSlot }: DayViewProps) {
  const byEmployee = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const emp of employees) {
      map[emp.id] = appointments.filter((a) => a.employee_id === emp.id)
    }
    return map
  }, [employees, appointments])

  return (
    <div className="flex overflow-x-auto">
      {/* Time column */}
      <div className="shrink-0 w-12 pt-10">
        {HOURS.map((h) => (
          <div key={h} className="h-16 flex items-start justify-end pr-2">
            <span className="text-xs text-zinc-500 -mt-2">{h}:00</span>
          </div>
        ))}
      </div>

      {/* Employee columns */}
      {employees.map((emp) => (
        <div key={emp.id} className="flex-1 min-w-[140px] border-l border-zinc-800">
          {/* Header */}
          <div className="h-10 flex items-center justify-center border-b border-zinc-800 px-2">
            <span className="text-xs font-semibold text-[#F5F5F5] truncate">{emp.name.split(' ')[0]}</span>
          </div>

          {/* Grid */}
          <div className="relative" style={{ height: HOURS.length * 64 }}>
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-zinc-800/50 cursor-pointer hover:bg-gold/5 transition-colors"
                style={{ top: (h - 9) * 64, height: 64 }}
                onClick={() => onAddSlot(emp.id, `${String(h).padStart(2, '0')}:00`)}
              />
            ))}
            {/* Half-hour dashed lines */}
            {HOURS.map((h) => (
              <div
                key={`${h}-half`}
                className="absolute left-0 right-0 border-t border-dashed border-zinc-800/30"
                style={{ top: (h - 9) * 64 + 32 }}
              />
            ))}
            {/* Appointments */}
            {byEmployee[emp.id]?.map((apt) => (
              <AppointmentBlock key={apt.id} apt={apt} onClick={onClickApt} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface WeekViewProps {
  weekStart: Date
  appointments: Appointment[]
  onClickDay: (date: string) => void
}

function WeekView({ weekStart, appointments, onClickDay }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const byDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (const apt of appointments) {
      if (apt.status === 'cancelled') continue
      const d = format(parseISO(apt.starts_at), 'yyyy-MM-dd')
      map[d] = (map[d] ?? 0) + 1
    }
    return map
  }, [appointments])

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="grid grid-cols-7 gap-1 px-2">
      {days.map((day) => {
        const iso = format(day, 'yyyy-MM-dd')
        const count = byDay[iso] ?? 0
        const isToday = iso === today

        return (
          <button
            key={iso}
            onClick={() => onClickDay(iso)}
            className={cn(
              'flex flex-col items-center py-3 rounded-xl transition-all',
              isToday ? 'bg-gold/10 border border-gold/30' : 'hover:bg-zinc-800',
            )}
          >
            <span className="text-xs text-zinc-400 uppercase mb-1">
              {format(day, 'EE', { locale: ru })}
            </span>
            <span className={cn('text-lg font-bold', isToday ? 'text-gold' : 'text-[#F5F5F5]')}>
              {format(day, 'd')}
            </span>
            {count > 0 && (
              <span className="mt-1 text-xs bg-gold/20 text-gold px-1.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface AptDetailDrawerProps {
  apt: Appointment | null
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}

function AptDetailDrawer({ apt, onClose, onStatusChange }: AptDetailDrawerProps) {
  if (!apt) return null

  const statusOptions = [
    { value: 'confirmed', label: '✅ Подтвердить' },
    { value: 'completed', label: '🏁 Выполнено' },
    { value: 'no_show',   label: '👻 Не пришёл' },
    { value: 'cancelled', label: '❌ Отменить' },
  ].filter((o) => o.value !== apt.status)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl p-5 max-w-lg mx-auto">
        <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-lg font-bold text-[#F5F5F5]">{apt.clients?.name}</p>
            <a href={`tel:${apt.clients?.phone}`} className="text-sm text-gold">
              {apt.clients?.phone}
            </a>
          </div>
          <StatusBadge status={apt.status} />
        </div>

        <div className="bg-zinc-800 rounded-xl p-4 flex flex-col gap-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Услуга</span>
            <span className="text-[#F5F5F5] font-medium">{apt.services?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Мастер</span>
            <span className="text-[#F5F5F5] font-medium">{apt.employees?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Время</span>
            <span className="text-[#F5F5F5] font-medium">
              {format(parseISO(apt.starts_at), 'HH:mm')} – {format(parseISO(apt.ends_at), 'HH:mm')}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onStatusChange(apt.id, opt.value); onClose() }}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[#F5F5F5] text-sm font-medium transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export function CalendarPage() {
  const { openAddModal: onAddAppointment } = useOutletContext<AdminContextType>()
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)

  const { appointments, updateStatus } = useAppointments(viewMode === 'day' ? selectedDate : undefined)
  const { employees } = useEmployees()

  const handlePrev = () => {
    if (viewMode === 'day') setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
    else setWeekStart(subWeeks(weekStart, 1))
  }

  const handleNext = () => {
    if (viewMode === 'day') setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
    else setWeekStart(addWeeks(weekStart, 1))
  }

  const handleToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    setSelectedDate(today)
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const displayLabel = viewMode === 'day'
    ? format(parseISO(selectedDate), 'd MMMM, EEEE', { locale: ru })
    : `${format(weekStart, 'd MMM', { locale: ru })} – ${format(addDays(weekStart, 6), 'd MMM', { locale: ru })}`

  return (
    <div className="flex flex-col h-[calc(100svh-56px)]">
      {/* Toolbar */}
      <div className="shrink-0 px-4 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {/* Mode toggle */}
          <div className="flex bg-zinc-800 rounded-xl p-1 gap-1">
            {(['day', 'week'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  viewMode === m ? 'bg-gold text-black' : 'text-zinc-400 hover:text-[#F5F5F5]',
                )}
              >
                {m === 'day' ? 'День' : 'Неделя'}
              </button>
            ))}
          </div>

          <button
            onClick={() => onAddAppointment?.()}
            className="flex items-center gap-1.5 bg-gold text-black px-3 py-2 rounded-xl text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        {/* Nav row */}
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
            <ChevronLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <button onClick={handleToday} className="flex-1 text-center text-sm font-semibold text-[#F5F5F5] capitalize">
            {displayLabel}
          </button>
          <button onClick={handleNext} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        {viewMode === 'week' ? (
          <WeekView
            weekStart={weekStart}
            appointments={appointments}
            onClickDay={(d) => { setSelectedDate(d); setViewMode('day') }}
          />
        ) : (
          <DayView
            date={selectedDate}
            employees={employees}
            appointments={appointments}
            onClickApt={setSelectedApt}
            onAddSlot={(empId, time) => onAddAppointment?.(empId, selectedDate, time)}
          />
        )}
      </div>

      {/* Appointment detail drawer */}
      <AptDetailDrawer
        apt={selectedApt}
        onClose={() => setSelectedApt(null)}
        onStatusChange={async (id, status) => {
          await updateStatus(id, status as never)
          setSelectedApt(null)
        }}
      />
    </div>
  )
}
