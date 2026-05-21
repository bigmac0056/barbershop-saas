export interface Employee {
  id: string
  name: string
  photo_url: string | null
  bio: string | null
  is_active: boolean
  created_at: string
}

export interface Service {
  id: string
  name: string
  duration_min: number
  price: number
  is_active: boolean
}

export interface WorkSchedule {
  id: string
  employee_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_day_off: boolean
}

export interface BlockedSlot {
  id: string
  employee_id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

export interface Client {
  id: string
  name: string
  phone: string
  created_at: string
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface Appointment {
  id: string
  client_id: string
  employee_id: string
  service_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  notes: string | null
  created_at: string
  clients?: Client
  employees?: Employee
  services?: Service
}

export interface TimeSlot {
  time: string
  available: boolean
}

export interface BookingState {
  service: Service | null
  employee: Employee | null
  date: string | null
  timeSlot: string | null
  clientName: string
  clientPhone: string
}
