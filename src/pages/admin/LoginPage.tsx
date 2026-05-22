import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.login(email, password)
      navigate('/admin')
    } catch {
      setError('Неверный email или пароль')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-4 max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-gold flex items-center justify-center mb-6 shadow-lg shadow-gold/25">
        <Scissors className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-[#1A1816] mb-1">BarberDom</h1>
      <p className="text-muted text-sm mb-8">Панель управления</p>

      <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="admin@barbershop.kz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          id="password"
          label="Пароль"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Войти
        </Button>
      </form>
    </div>
  )
}
