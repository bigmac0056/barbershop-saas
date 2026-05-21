import { useEffect, useState } from 'react'
import { Phone, Search } from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'
import { api } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Client } from '@/types'

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getClients()
      .then((data) => setClients(data))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  )

  return (
    <div className="min-h-svh flex flex-col max-w-2xl mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[#1F1F1F] px-4 py-3">
        <h1 className="font-bold text-[#F5F5F5] mb-3">Клиенты</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            placeholder="Поиск по имени или телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-[#333] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#F5F5F5] placeholder:text-muted focus:outline-none focus:border-gold/60"
          />
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <PageSpinner />
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted py-16">Клиенты не найдены</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((client) => (
              <div key={client.id} className="bg-surface rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-gold font-bold shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#F5F5F5] truncate">{client.name}</p>
                  <p className="text-xs text-muted">
                    с {format(parseISO(client.created_at), 'd MMM yyyy', { locale: ru })}
                  </p>
                </div>
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-gold transition-colors shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {client.phone}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
