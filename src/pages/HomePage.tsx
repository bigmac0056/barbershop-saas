import { useNavigate } from 'react-router-dom'
import { Scissors, MapPin, Clock, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function HomePage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-5 max-w-sm mx-auto">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gold flex items-center justify-center mb-4 shadow-lg shadow-gold/25">
          <Scissors className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[#1A1816] tracking-tight">BarberDom</h1>
        <p className="text-muted text-sm mt-1">Барбершоп · Павлодар</p>
      </div>

      {/* Info */}
      <div className="w-full bg-surface rounded-2xl border border-border p-4 mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Режим работы</p>
            <p className="text-sm font-semibold text-[#1A1816]">09:00 – 01:00 · Ежедневно</p>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Адрес</p>
            <p className="text-sm font-semibold text-[#1A1816]">ул. Уральская, 42</p>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-gold" />
          </div>
          <div>
            <p className="text-xs text-muted">Телефон / WhatsApp</p>
            <a href="tel:+77714755421" className="text-sm font-semibold text-gold">+7 771 475 5421</a>
          </div>
        </div>
      </div>

      <Button size="lg" fullWidth onClick={() => navigate('/book')}>
        Записаться онлайн
      </Button>

      <p className="text-xs text-muted mt-4 text-center">
        Запись займёт меньше минуты
      </p>
    </div>
  )
}
