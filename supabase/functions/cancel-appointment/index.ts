import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { appointment_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: apt } = await supabase
    .from('appointments')
    .select('status, starts_at')
    .eq('id', appointment_id)
    .single()

  if (!apt) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
  }

  if (apt.status === 'completed') {
    return new Response(JSON.stringify({ error: 'Cannot cancel completed appointment' }), {
      status: 400,
      headers: corsHeaders,
    })
  }

  await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointment_id)

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
