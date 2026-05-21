import { useNavigate } from 'react-router-dom'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function HomePage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
      <div className="w-20 h-20 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
        <Scissors className="w-9 h-9 text-gold" />
      </div>
      <h1 className="text-3xl font-bold text-[#F5F5F5] mb-2">Барбершоп</h1>
      <p className="text-muted mb-10 leading-relaxed">
        Запишитесь онлайн за 1 минуту. Выберите удобное время и мастера.
      </p>
      <Button size="lg" fullWidth onClick={() => navigate('/book')}>
        Записаться
      </Button>
    </div>
  )
}
