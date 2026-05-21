import { User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { useEmployees } from '@/hooks/useEmployees'
import type { Employee } from '@/types'

interface Props {
  serviceId: string
  selected: Employee | null
  onSelect: (employee: Employee) => void
}

export function EmployeeSelect({ serviceId, selected, onSelect }: Props) {
  const { employees, loading } = useEmployees(serviceId)

  if (loading) return <PageSpinner />

  return (
    <div className="flex flex-col gap-3">
      {employees.map((emp) => (
        <Card
          key={emp.id}
          selected={selected?.id === emp.id}
          hoverable
          onClick={() => onSelect(emp)}
          className="flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-full bg-surface-2 overflow-hidden shrink-0 flex items-center justify-center">
            {emp.photo_url ? (
              <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-muted" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-[#F5F5F5]">{emp.name}</p>
            {emp.bio && <p className="text-sm text-muted mt-0.5 line-clamp-1">{emp.bio}</p>}
          </div>
        </Card>
      ))}
    </div>
  )
}
