import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { XCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

export function CancelPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const appointmentId = params.get('id')
  const [loading, setLoading] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCancel = async () => {
    if (!appointmentId) return
    setLoading(true)
    try {
      await api.cancelAppointment(appointmentId)
      setCancelled(true)
    } catch {
      setError('Не удалось отменить запись. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  if (cancelled) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-4 max-w-lg mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1816]">Запись отменена</h1>
        <p className="text-muted mt-2 mb-8">Ваша запись успешно отменена</p>
        <Button onClick={() => navigate('/')}>Записаться снова</Button>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-4 max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
        <XCircle className="w-10 h-10 text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-[#1A1816] mb-2">Отменить запись?</h1>
      <p className="text-muted mb-8">Это действие нельзя отменить</p>
      {error && <p className="text-danger text-sm mb-4">{error}</p>}
      <div className="w-full flex flex-col gap-3">
        <Button variant="danger" fullWidth loading={loading} onClick={handleCancel}>
          Да, отменить
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate(-1)}>
          Назад
        </Button>
      </div>
    </div>
  )
}
