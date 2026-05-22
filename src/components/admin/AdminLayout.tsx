import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Users } from 'lucide-react'
import { AddAppointmentModal } from './AddAppointmentModal'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin',          label: 'Сегодня',  icon: LayoutDashboard, end: true },
  { to: '/admin/calendar', label: 'Календарь', icon: CalendarDays,    end: false },
  { to: '/admin/clients',  label: 'Клиенты',  icon: Users,            end: false },
]

// Context для передачи onAddAppointment в дочерние страницы
export interface AdminContextType {
  openAddModal: (employeeId?: string, date?: string, time?: string) => void
}

export function AdminLayout() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefaults, setModalDefaults] = useState<{
    employeeId?: string
    date?: string
    time?: string
  }>({})

  const openAddModal = (employeeId?: string, date?: string, time?: string) => {
    setModalDefaults({ employeeId, date, time })
    setModalOpen(true)
  }

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <div className="flex-1 pb-14">
        <Outlet context={{ openAddModal }} />
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur-md safe-bottom z-30">
        <div className="flex max-w-lg mx-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-gold' : 'text-muted hover:text-[#1A1816]',
                )
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Global add appointment modal */}
      <AddAppointmentModal
        open={modalOpen}
        defaultEmployeeId={modalDefaults.employeeId}
        defaultDate={modalDefaults.date}
        defaultTime={modalDefaults.time}
        onClose={() => setModalOpen(false)}
        onCreated={() => setModalOpen(false)}
      />
    </div>
  )
}
