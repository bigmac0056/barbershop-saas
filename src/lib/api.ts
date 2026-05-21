import type { Service, Employee, Appointment, AppointmentStatus, Client } from '@/types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

function token(): string | null {
  return localStorage.getItem('admin_token')
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers['Authorization'] = `Bearer ${t}`
  Object.assign(headers, (init.headers as Record<string, string>) ?? {})

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<void> => {
    const data = await request<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem('admin_token', data.access_token)
  },
  logout: () => localStorage.removeItem('admin_token'),
  isAuthenticated: () => !!token(),

  // Services
  getServices: () => request<Service[]>('/api/services'),

  // Employees
  getEmployees: (serviceId?: string) =>
    request<Employee[]>(`/api/employees${serviceId ? `?service_id=${encodeURIComponent(serviceId)}` : ''}`),

  // Slots
  getSlots: (employeeId: string, date: string, serviceId: string) =>
    request<{ slots: string[] }>(
      `/api/slots?employee_id=${encodeURIComponent(employeeId)}&date=${encodeURIComponent(date)}&service_id=${encodeURIComponent(serviceId)}`,
    ),

  // Appointments
  getAppointments: (date?: string) =>
    request<Appointment[]>(`/api/appointments${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getAppointment: (id: string) => request<Appointment>(`/api/appointments/${encodeURIComponent(id)}`),

  createAppointment: (body: {
    service_id: string
    employee_id: string
    date: string
    time: string
    client_name: string
    client_phone: string
    notes?: string
  }) =>
    request<{ appointment_id: string }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancelAppointment: (id: string) =>
    request<{ ok: boolean }>(`/api/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),

  updateStatus: (id: string, status: AppointmentStatus) =>
    request<{ ok: boolean }>(`/api/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Clients (admin)
  getClients: () => request<Client[]>('/api/clients'),
}
