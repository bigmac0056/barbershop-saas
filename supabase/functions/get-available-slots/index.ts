import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { employee_id, date, service_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Get service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_min')
    .eq('id', service_id)
    .single()

  if (!service) {
    return new Response(JSON.stringify({ slots: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // 2. Get day of week (0=Mon, 6=Sun using JS Date where 0=Sun)
  const dateObj = new Date(date + 'T12:00:00Z')
  const jsDow = dateObj.getUTCDay() // 0=Sun
  const dow = jsDow === 0 ? 6 : jsDow - 1 // convert to Mon=0

  // 3. Get work schedule
  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('employee_id', employee_id)
    .eq('day_of_week', dow)
    .single()

  if (!schedule || schedule.is_day_off) {
    return new Response(JSON.stringify({ slots: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // 4. Get existing appointments for that day
  const dayStart = `${date}T00:00:00+00:00`
  const dayEnd = `${date}T23:59:59+00:00`

  const { data: existingApts } = await supabase
    .from('appointments')
    .select('starts_at, ends_at')
    .eq('employee_id', employee_id)
    .neq('status', 'cancelled')
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd)

  // 5. Get blocked slots
  const { data: blockedSlots } = await supabase
    .from('blocked_slots')
    .select('starts_at, ends_at')
    .eq('employee_id', employee_id)
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd)

  const busy = [...(existingApts ?? []), ...(blockedSlots ?? [])]

  // 6. Generate 30-min slots within work hours
  const [startH, startM] = schedule.start_time.split(':').map(Number)
  const [endH, endM] = schedule.end_time.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  const duration = service.duration_min

  const slots: string[] = []
  const now = new Date()
  const isToday = new Date(date + 'T00:00:00').toDateString() === now.toDateString()

  for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
    const slotHour = Math.floor(m / 60)
    const slotMin = m % 60
    const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`
    const slotStart = new Date(`${date}T${timeStr}:00`)
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000)

    // Skip past slots for today
    if (isToday && slotStart <= now) continue

    // Check overlap
    const overlaps = busy.some((b) => {
      const bStart = new Date(b.starts_at)
      const bEnd = new Date(b.ends_at)
      return slotStart < bEnd && slotEnd > bStart
    })

    if (!overlaps) slots.push(timeStr)
  }

  return new Response(JSON.stringify({ slots }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
