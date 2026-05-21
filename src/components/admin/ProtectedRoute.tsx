import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/lib/api'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!api.isAuthenticated()) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
