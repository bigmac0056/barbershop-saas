import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatPhone, normalizePhone } from '@/lib/utils'

interface Props {
  onSubmit: (name: string, phone: string) => void
  loading: boolean
}

export function ContactForm({ onSubmit, loading }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
  }

  const validate = () => {
    const errs: typeof errors = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Введите имя (минимум 2 символа)'
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 11) errs.phone = 'Введите полный номер телефона'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit(name.trim(), normalizePhone(phone))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="client-name"
        label="Ваше имя"
        placeholder="Алибек"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoFocus
        autoComplete="given-name"
      />
      <Input
        id="client-phone"
        label="Номер телефона"
        placeholder="+7 (___) ___-__-__"
        value={phone}
        onChange={handlePhoneChange}
        error={errors.phone}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
      />
      <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
        Записаться
      </Button>
    </form>
  )
}
