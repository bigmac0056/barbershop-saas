import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { LogOut, RefreshCw, Phone, Clock, Scissors, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { useAppointments } from '@/hooks/useAppointments'
import { api } from '@/lib/api'
import { formatDuration } from '@/lib/utils'
import type { Appointment, AppointmentStatus } from '@/types'
import type { AdminContextType } from '@/components/admin/AdminLayout'

const STATUS_NEXT: Record<AppointmentStatus, { label: string; next: AppointmentStatus } | null> = {
  pending:   { label: 'Подтвердить ✅', next: 'confirmed' },
  confirmed: { label: 'Выполнено 🏁',   next: 'completed' },
  completed: null,
  cancelled: null,
  no_show:   null,
}

function AptCard({ apt, onStatus }: { apt: Appointment; onStatus: (id: string, s: AppointmentStatus) => void }) {
  const [open, setOpen] = useState(false)
  const next = STATUS_NEXT[apt.status]

  return (
    <div
      className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
      onClick={() => setOpen((v) => !v)}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Time */}
        <div className="shrink-0 text-center w-12">
          <p className="text-lg font-bold text-[#F5F5F5] leading-none">
            {format(parseISO(apt.starts_at), 'HH:mm')}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {format(parseISO(apt.ends_at), 'HH:mm')}
          </p>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-zinc-700 shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F5F5F5] truncate">{apt.clients?.name}</p>
          <p className="text-xs text-zinc-400 truncate">
            {apt.services?.name} · {apt.employees?.name?.split(' ')[0]}
          </p>
        </div>

        <StatusBadge status={apt.status} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-800/40 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <a
              href={`tel:${apt.clients?.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 px-3 py-2 rounded-xl"
            >
              <Phone className="w-3.5 h-3.5" />
              {apt.clients?.phone}
            </a>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 px-3 py-2 rounded-xl">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(apt.services?.duration_min ?? 0)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 px-3 py-2 rounded-xl">
              <Scissors className="w-3.5 h-3.5" />
              {apt.services?.name}
            </div>
          </div>

          {apt.notes && (
            <p className="text-xs text-zinc-400 italic">💬 {apt.notes}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {next && (
              <Button
                size="sm"
                onClick={() => onStatus(apt.id, next.next)}
              >
                {next.label}
              </Button>
            )}
            {apt.status !== 'cancelled' && apt.status !== 'completed' && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onStatus(apt.id, 'cancelled')}
              >
                Отменить
              </Button>
            )}
            {apt.status !== 'no_show' && apt.status !== 'completed' && apt.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onStatus(apt.id, 'no_show')}
              >
                Не пришёл
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { openAddModal } = useOutletContext<AdminContextType>()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { appointments, loading, refresh, updateStatus } = useAppointments(selectedDate)

  const handleStatus = async (id: string, status: AppointmentStatus) => {
    await updateStatus(id, status)
  }

  const handleLogout = () => {
    api.logout()
    window.location.href = '/admin/login'
  }

  const goDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(format(d, 'yyyy-MM-dd'))
  }

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  const active = appointments.filter((a) => a.status !== 'cancelled')
  const pending = appointments.filter((a) => a.status === 'pending').length
  const confirmed = appointments.filter((a) => a.status === 'confirmed').length
  const completed = appointments.filter((a) => a.status === 'completed').length

  return (
    <div className="flex flex-col min-h-[calc(100svh-56px)]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => goDate(-1)} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              className="text-sm font-bold text-[#F5F5F5] capitalize min-w-[160px] text-center"
            >
              {isToday
                ? `Сегодня, ${format(new Date(selectedDate + 'T12:00:00'), 'd MMMM', { locale: ru })}`
                : format(new Date(selectedDate + 'T12:00:00'), 'd MMMM, EEEE', { locale: ru })}
            </button>
            <button onClick={() => goDate(1)} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={refresh} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
              <RefreshCw className="w-4 h-4 text-zinc-500" />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-zinc-800 transition-colors">
              <LogOut className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Всего',    value: active.length,  color: 'text-[#F5F5F5]' },
            { label: 'Ожидает', value: pending,         color: 'text-yellow-400' },
            { label: 'Подтв.',  value: confirmed,       color: 'text-blue-400' },
            { label: 'Готово',  value: completed,       color: 'text-green-400' },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 rounded-xl py-2 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-4 py-4">
        {loading ? (
          <PageSpinner />
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-zinc-500 text-sm">Записей нет</p>
            <Button size="sm" onClick={() => openAddModal(undefined, selectedDate)}>
              <Plus className="w-4 h-4 mr-1" /> Добавить запись
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {appointments.map((apt) => (
              <AptCard key={apt.id} apt={apt} onStatus={handleStatus} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => openAddModal(undefined, selectedDate)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-gold rounded-full flex items-center justify-center shadow-lg shadow-gold/20 z-20 active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6 text-black" />
      </button>
    </div>
  )
}
