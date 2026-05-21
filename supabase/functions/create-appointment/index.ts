import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { service_id, employee_id, date, time, client_name, client_phone } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Get service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_min')
    .eq('id', service_id)
    .single()

  if (!service) {
    return new Response(JSON.stringify({ error: 'Service not found' }), { status: 400, headers: corsHeaders })
  }

  const startsAt = new Date(`${date}T${time}:00`)
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60 * 1000)

  // Check for conflicts using RPC (atomic check + insert)
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('employee_id', employee_id)
    .neq('status', 'cancelled')
    .lt('starts_at', endsAt.toISOString())
    .gt('ends_at', startsAt.toISOString())

  if (conflicts && conflicts.length > 0) {
    return new Response(JSON.stringify({ error: 'Slot already taken' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Upsert client (phone is unique key)
  const normalizedPhone = client_phone.replace(/\D/g, '')
  const phoneFormatted = normalizedPhone.startsWith('8')
    ? '+7' + normalizedPhone.slice(1)
    : '+' + normalizedPhone

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .upsert({ name: client_name, phone: phoneFormatted }, { onConflict: 'phone' })
    .select()
    .single()

  if (clientErr || !client) {
    return new Response(JSON.stringify({ error: 'Client error' }), { status: 500, headers: corsHeaders })
  }

  // Create appointment
  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .insert({
      client_id: client.id,
      employee_id,
      service_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'pending',
    })
    .select()
    .single()

  if (aptErr || !appointment) {
    return new Response(JSON.stringify({ error: 'Appointment error' }), { status: 500, headers: corsHeaders })
  }

  // Notify admin via Telegram (optional, non-blocking)
  const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const tgChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')
  if (tgToken && tgChatId) {
    const msg = `🆕 Новая запись!\n👤 ${client_name} ${phoneFormatted}\n📅 ${date} ${time}\n✂️ услуга: ${service_id}`
    fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChatId, text: msg }),
    }).catch(() => {})
  }

  return new Response(JSON.stringify({ appointment_id: appointment.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
