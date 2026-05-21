import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const WA_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!

// ─── Отправить сообщение клиенту ───────────────────────────────────────────
async function sendMessage(to: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}

// ─── Отправить интерактивные кнопки ────────────────────────────────────────
async function sendButtons(to: string, body: string, buttons: { id: string; title: string }[]) {
  await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  })
}

// ─── Состояния диалога (хранятся в БД) ─────────────────────────────────────
type ConversationStep =
  | 'idle'
  | 'awaiting_service'
  | 'awaiting_employee'
  | 'awaiting_date'
  | 'awaiting_time'
  | 'awaiting_name'

interface ConversationState {
  step: ConversationStep
  service_id?: string
  service_name?: string
  service_duration?: number
  employee_id?: string
  employee_name?: string
  date?: string
}

async function getState(phone: string): Promise<ConversationState> {
  const { data } = await supabase
    .from('whatsapp_sessions')
    .select('state')
    .eq('phone', phone)
    .single()
  return (data?.state as ConversationState) ?? { step: 'idle' }
}

async function setState(phone: string, state: ConversationState) {
  await supabase
    .from('whatsapp_sessions')
    .upsert({ phone, state, updated_at: new Date().toISOString() }, { onConflict: 'phone' })
}

async function clearState(phone: string) {
  await setState(phone, { step: 'idle' })
}

// ─── Главный обработчик входящего сообщения ────────────────────────────────
async function handleMessage(from: string, text: string, buttonId?: string) {
  const input = (buttonId ?? text).trim().toLowerCase()
  const state = await getState(from)

  // Сброс в любой момент
  if (input === 'отмена' || input === 'cancel' || input === 'стоп') {
    await clearState(from)
    await sendMessage(from, '❌ Запись отменена. Напишите *Записаться* чтобы начать заново.')
    return
  }

  // ── IDLE: главное меню ──────────────────────────────────────────────────
  if (state.step === 'idle') {
    await sendButtons(from,
      '👋 Привет! Я помогу вам записаться в барбершоп.',
      [
        { id: 'book', title: '✂️ Записаться' },
        { id: 'my_booking', title: '📋 Моя запись' },
      ]
    )
    await setState(from, { step: 'awaiting_service' })
    return
  }

  // ── Шаг 1: Кнопка главного меню / выбор услуги ────────────────────────
  if (state.step === 'awaiting_service' || input === 'book' || buttonId === 'book') {
    if (buttonId === 'my_booking' || input === 'my_booking') {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', `+${from}`)
        .single()

      if (!client) {
        await sendMessage(from, '😕 Записей не найдено. Напишите *Записаться* чтобы создать запись.')
        await clearState(from)
        return
      }

      const { data: apts } = await supabase
        .from('appointments')
        .select('starts_at, status, services(name), employees(name)')
        .eq('client_id', client.id)
        .in('status', ['pending', 'confirmed'])
        .order('starts_at')
        .limit(3)

      if (!apts || apts.length === 0) {
        await sendMessage(from, '📭 Активных записей нет.\n\nНапишите *Записаться* чтобы создать запись.')
      } else {
        const lines = apts.map((a) => {
          const dt = new Date(a.starts_at as string)
          const date = dt.toLocaleDateString('ru', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' })
          const time = dt.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })
          const svc = (a.services as { name: string } | null)?.name ?? ''
          const emp = (a.employees as { name: string } | null)?.name ?? ''
          return `📅 ${date} в ${time}\n✂️ ${svc} · ${emp}\nСтатус: ${a.status === 'pending' ? 'ожидает' : 'подтверждена'}`
        })
        await sendMessage(from, `📋 *Ваши записи:*\n\n${lines.join('\n\n')}`)
      }
      await clearState(from)
      return
    }

    // Показываем список услуг
    const { data: services } = await supabase
      .from('services')
      .select('id, name, price, duration_min')
      .eq('is_active', true)

    if (!services?.length) {
      await sendMessage(from, 'Услуги временно недоступны. Попробуйте позже.')
      await clearState(from)
      return
    }

    const list = services.map((s, i) => `*${i + 1}.* ${s.name} — ${s.price} ₸ (${s.duration_min} мин)`).join('\n')
    await sendMessage(from, `✂️ *Выберите услугу:*\n\n${list}\n\nОтправьте номер (1, 2, 3...)`)
    await setState(from, { step: 'awaiting_service' })

    // Сохраняем список услуг во временном ключе через setState trick
    await supabase.from('whatsapp_sessions')
      .upsert({ phone: from, state: { step: 'awaiting_service', _services: services }, updated_at: new Date().toISOString() }, { onConflict: 'phone' })
    return
  }

  // ── Шаг 1 → выбрана услуга ─────────────────────────────────────────────
  if (state.step === 'awaiting_service') {
    const rawState = await supabase.from('whatsapp_sessions').select('state').eq('phone', from).single()
    const fullState = rawState.data?.state as (ConversationState & { _services?: { id: string; name: string; duration_min: number }[] })
    const services = fullState?._services ?? []

    const idx = parseInt(input) - 1
    const service = services[idx]
    if (!service) {
      await sendMessage(from, `Введите число от 1 до ${services.length}`)
      return
    }

    // Показываем мастеров
    const { data: empLinks } = await supabase
      .from('employee_services')
      .select('employees(id, name, bio)')
      .eq('service_id', service.id)

    const employees = (empLinks ?? [])
      .map((e) => (e as { employees: { id: string; name: string; bio: string | null } | null }).employees)
      .filter(Boolean) as { id: string; name: string; bio: string | null }[]

    const list = employees.map((e, i) => `*${i + 1}.* ${e.name}${e.bio ? `\n   _${e.bio}_` : ''}`).join('\n')
    await sendMessage(from, `👨‍💈 *Выберите мастера:*\n\n${list}\n\nОтправьте номер`)

    await supabase.from('whatsapp_sessions').upsert({
      phone: from,
      state: {
        step: 'awaiting_employee',
        service_id: service.id,
        service_name: service.name,
        service_duration: service.duration_min,
        _employees: employees,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    return
  }

  // ── Шаг 2 → выбран мастер ──────────────────────────────────────────────
  if (state.step === 'awaiting_employee') {
    const rawState = await supabase.from('whatsapp_sessions').select('state').eq('phone', from).single()
    const fullState = rawState.data?.state as ConversationState & { _employees?: { id: string; name: string }[] }
    const employees = fullState?._employees ?? []

    const idx = parseInt(input) - 1
    const emp = employees[idx]
    if (!emp) {
      await sendMessage(from, `Введите число от 1 до ${employees.length}`)
      return
    }

    // Показываем ближайшие 7 дней
    const days: string[] = []
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() + i)
      days.push(d.toISOString().slice(0, 10))
    }
    const list = days.map((d, i) => {
      const dt = new Date(d)
      const label = dt.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      return `*${i + 1}.* ${label}`
    }).join('\n')

    await sendMessage(from, `📅 *Выберите дату:*\n\n${list}\n\nОтправьте номер`)
    await supabase.from('whatsapp_sessions').upsert({
      phone: from,
      state: {
        ...fullState,
        step: 'awaiting_date',
        employee_id: emp.id,
        employee_name: emp.name,
        _days: days,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    return
  }

  // ── Шаг 3 → выбрана дата ───────────────────────────────────────────────
  if (state.step === 'awaiting_date') {
    const rawState = await supabase.from('whatsapp_sessions').select('state').eq('phone', from).single()
    const fullState = rawState.data?.state as ConversationState & { _days?: string[] }
    const days = fullState?._days ?? []

    const idx = parseInt(input) - 1
    const date = days[idx]
    if (!date) {
      await sendMessage(from, `Введите число от 1 до ${days.length}`)
      return
    }

    // Запрашиваем слоты
    const { data: slotsData } = await supabase.functions.invoke('get-available-slots', {
      body: { employee_id: fullState.employee_id, date, service_id: fullState.service_id },
    })
    const slots: string[] = slotsData?.slots ?? []

    if (slots.length === 0) {
      await sendMessage(from, '😔 На эту дату нет свободных слотов. Выберите другую дату.\n\nОтправьте номер даты.')
      return
    }

    const list = slots.map((s, i) => `*${i + 1}.* ${s}`).join('  ')
    await sendMessage(from, `⏰ *Свободное время:*\n\n${list}\n\nОтправьте номер`)

    await supabase.from('whatsapp_sessions').upsert({
      phone: from,
      state: { ...fullState, step: 'awaiting_time', date, _slots: slots },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    return
  }

  // ── Шаг 4 → выбрано время ──────────────────────────────────────────────
  if (state.step === 'awaiting_time') {
    const rawState = await supabase.from('whatsapp_sessions').select('state').eq('phone', from).single()
    const fullState = rawState.data?.state as ConversationState & { _slots?: string[] }
    const slots = fullState?._slots ?? []

    const idx = parseInt(input) - 1
    const timeSlot = slots[idx]
    if (!timeSlot) {
      await sendMessage(from, `Введите число от 1 до ${slots.length}`)
      return
    }

    await sendMessage(from,
      `✅ Почти готово!\n\n` +
      `📋 *Услуга:* ${fullState.service_name}\n` +
      `👨‍💈 *Мастер:* ${fullState.employee_name}\n` +
      `📅 *Дата:* ${fullState.date} в ${timeSlot}\n\n` +
      `Как вас зовут? (Введите имя)`
    )

    await supabase.from('whatsapp_sessions').upsert({
      phone: from,
      state: { ...fullState, step: 'awaiting_name', timeSlot },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    return
  }

  // ── Шаг 5 → получено имя → создаём запись ──────────────────────────────
  if (state.step === 'awaiting_name') {
    const rawState = await supabase.from('whatsapp_sessions').select('state').eq('phone', from).single()
    const fullState = rawState.data?.state as ConversationState & { timeSlot?: string }

    const name = text.trim()
    if (name.length < 2) {
      await sendMessage(from, 'Введите ваше имя (минимум 2 буквы)')
      return
    }

    const phone = `+${from}`
    const { data: result, error } = await supabase.functions.invoke('create-appointment', {
      body: {
        service_id: fullState.service_id,
        employee_id: fullState.employee_id,
        date: fullState.date,
        time: fullState.timeSlot,
        client_name: name,
        client_phone: phone,
      },
    })

    if (error || !result?.appointment_id) {
      await sendMessage(from, '❌ Не удалось создать запись. Возможно, слот уже занят. Попробуйте выбрать другое время.\n\nНапишите *Записаться* чтобы начать снова.')
    } else {
      await sendMessage(from,
        `🎉 *Запись создана!*\n\n` +
        `👤 ${name}\n` +
        `✂️ ${fullState.service_name}\n` +
        `👨‍💈 ${fullState.employee_name}\n` +
        `📅 ${fullState.date} в ${fullState.timeSlot}\n\n` +
        `Ждём вас! Если нужно отменить — напишите *Отмена записи*.`
      )
    }

    await clearState(from)
    return
  }

  // ── Дефолт: если написали что-то непонятное ─────────────────────────────
  await sendButtons(from,
    '👋 Что вас интересует?',
    [
      { id: 'book', title: '✂️ Записаться' },
      { id: 'my_booking', title: '📋 Моя запись' },
    ]
  )
  await setState(from, { step: 'awaiting_service' })
}

// ─── HTTP Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Верификация webhook от Meta
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    const entry = body?.entry?.[0]?.changes?.[0]?.value
    const message = entry?.messages?.[0]

    if (!message) return new Response('ok')

    const from: string = message.from
    const text: string = message.type === 'text' ? message.text.body : ''
    const buttonId: string | undefined =
      message.type === 'interactive'
        ? message.interactive?.button_reply?.id
        : undefined

    await handleMessage(from, text, buttonId)
  } catch (e) {
    console.error(e)
  }

  return new Response('ok', { headers: corsHeaders })
})
