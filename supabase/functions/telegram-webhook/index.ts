import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Telegram API helpers ─────────────────────────────────────────────────────

async function tg(method: string, body: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function sendText(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra })
}

async function sendButtons(
  chatId: number,
  text: string,
  rows: { text: string; callback_data: string }[][],
) {
  await tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  })
}

async function answerCallback(callbackQueryId: string, text = '') {
  await tg('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

// ── Session state ────────────────────────────────────────────────────────────

type Step = 'idle' | 'service' | 'employee' | 'date' | 'time' | 'name' | 'phone'

interface Session {
  step: Step
  service_id?: string
  service_name?: string
  service_duration?: number
  employee_id?: string
  employee_name?: string
  date?: string
  time?: string
  name?: string
}

async function getSession(chatId: number): Promise<Session> {
  const { data } = await supabase
    .from('whatsapp_sessions')
    .select('state')
    .eq('phone', String(chatId))
    .single()
  return (data?.state as Session) ?? { step: 'idle' }
}

async function saveSession(chatId: number, session: Session) {
  await supabase
    .from('whatsapp_sessions')
    .upsert(
      { phone: String(chatId), state: session, updated_at: new Date().toISOString() },
      { onConflict: 'phone' },
    )
}

async function clearSession(chatId: number) {
  await saveSession(chatId, { step: 'idle' })
}

// ── Screens ──────────────────────────────────────────────────────────────────

async function showMainMenu(chatId: number) {
  await sendButtons(chatId, '👋 <b>Барбершоп</b>\n\nВыберите действие:', [[
    { text: '✂️ Записаться', callback_data: 'start_book' },
    { text: '📋 Мои записи', callback_data: 'my_bookings' },
  ]])
  await saveSession(chatId, { step: 'idle' })
}

async function showServices(chatId: number) {
  const { data: services } = await supabase
    .from('services')
    .select('id, name, price, duration_min')
    .eq('is_active', true)
    .order('price')

  if (!services?.length) {
    await sendText(chatId, 'Услуги временно недоступны.')
    return
  }

  const rows = services.map((s) => [{
    text: `${s.name} — ${s.price.toLocaleString('ru')} ₸ (${s.duration_min} мин)`,
    callback_data: `svc:${s.id}:${encodeURIComponent(s.name)}:${s.duration_min}`,
  }])

  await sendButtons(chatId, '✂️ <b>Выберите услугу:</b>', rows)
  await saveSession(chatId, { step: 'service' })
}

async function showEmployees(chatId: number, session: Session) {
  const { data: links } = await supabase
    .from('employee_services')
    .select('employees(id, name)')
    .eq('service_id', session.service_id!)

  const employees = (links ?? [])
    .map((l) => (l as { employees: { id: string; name: string } | null }).employees)
    .filter(Boolean) as { id: string; name: string }[]

  if (!employees.length) {
    await sendText(chatId, 'Нет доступных мастеров.')
    return
  }

  const rows = employees.map((e) => [{
    text: `👨‍💈 ${e.name}`,
    callback_data: `emp:${e.id}:${encodeURIComponent(e.name)}`,
  }])

  await sendButtons(chatId, '👨‍💈 <b>Выберите мастера:</b>', rows)
  await saveSession(chatId, { ...session, step: 'employee' })
}

async function showDates(chatId: number, session: Session) {
  const days: { text: string; callback_data: string }[][] = []
  const today = new Date()

  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('ru-RU', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Almaty',
    })
    days.push([{ text: i === 0 ? `📅 Сегодня (${label})` : `📅 ${label}`, callback_data: `date:${iso}` }])
  }

  await sendButtons(chatId, '📅 <b>Выберите дату:</b>', days)
  await saveSession(chatId, { ...session, step: 'date' })
}

async function showSlots(chatId: number, session: Session) {
  const { data } = await supabase.functions.invoke('get-available-slots', {
    body: {
      employee_id: session.employee_id,
      date: session.date,
      service_id: session.service_id,
    },
  })

  const slots: string[] = data?.slots ?? []

  if (!slots.length) {
    await sendText(chatId, '😔 Нет свободных слотов на эту дату.\n\nВыберите другую дату:')
    await showDates(chatId, session)
    return
  }

  // Group slots by pairs for compact display
  const rows: { text: string; callback_data: string }[][] = []
  for (let i = 0; i < slots.length; i += 3) {
    rows.push(
      slots.slice(i, i + 3).map((s) => ({ text: `⏰ ${s}`, callback_data: `time:${s}` }))
    )
  }

  const dateLabel = new Date(session.date! + 'T12:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  })
  await sendButtons(chatId, `⏰ <b>Свободное время на ${dateLabel}:</b>`, rows)
  await saveSession(chatId, { ...session, step: 'time' })
}

async function showMyBookings(chatId: number) {
  // Find client by telegram chat id stored as phone
  const tgPhone = `tg:${chatId}`
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', tgPhone)
    .single()

  if (!client) {
    await sendText(chatId, '😕 У вас нет записей.\n\nЧтобы записаться, нажмите /start')
    return
  }

  const { data: apts } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, status, services(name), employees(name)')
    .eq('client_id', client.id)
    .in('status', ['pending', 'confirmed'])
    .order('starts_at')
    .limit(5)

  if (!apts?.length) {
    await sendText(chatId, '📭 Активных записей нет.\n\n/start — записаться')
    return
  }

  let text = '📋 <b>Ваши записи:</b>\n\n'
  for (const a of apts) {
    const dt = new Date(a.starts_at as string)
    const dateStr = dt.toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', weekday: 'short', timeZone: 'Asia/Almaty',
    })
    const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })
    const svc = (a.services as { name: string } | null)?.name
    const emp = (a.employees as { name: string } | null)?.name
    const status = a.status === 'pending' ? '⏳ ожидает' : '✅ подтверждена'
    text += `📅 ${dateStr} в ${timeStr}\n✂️ ${svc} · ${emp}\n${status}\n\n`
  }

  await sendButtons(chatId, text.trim(), [[
    { text: '✂️ Новая запись', callback_data: 'start_book' },
  ]])
}

// ── Admin notification ───────────────────────────────────────────────────────

async function notifyAdmin(text: string) {
  if (!ADMIN_CHAT_ID) return
  await sendText(Number(ADMIN_CHAT_ID), text)
}

// ── Main handler ─────────────────────────────────────────────────────────────

async function handleUpdate(update: Record<string, unknown>) {
  // Callback query (button press)
  if (update.callback_query) {
    const cq = update.callback_query as {
      id: string
      from: { id: number }
      data: string
    }
    const chatId = cq.from.id
    const data = cq.data
    const session = await getSession(chatId)

    await answerCallback(cq.id)

    if (data === 'start_book') {
      await showServices(chatId)
      return
    }

    if (data === 'my_bookings') {
      await showMyBookings(chatId)
      return
    }

    if (data.startsWith('svc:')) {
      const [, id, name, dur] = data.split(':')
      const newSession: Session = {
        ...session,
        step: 'employee',
        service_id: id,
        service_name: decodeURIComponent(name),
        service_duration: Number(dur),
      }
      await showEmployees(chatId, newSession)
      return
    }

    if (data.startsWith('emp:')) {
      const [, id, name] = data.split(':')
      const newSession: Session = {
        ...session,
        step: 'date',
        employee_id: id,
        employee_name: decodeURIComponent(name),
      }
      await showDates(chatId, newSession)
      return
    }

    if (data.startsWith('date:')) {
      const date = data.split(':')[1]
      const newSession: Session = { ...session, step: 'time', date }
      await showSlots(chatId, newSession)
      return
    }

    if (data.startsWith('time:')) {
      const time = data.split(':')[1]
      const newSession: Session = { ...session, step: 'name', time }
      await saveSession(chatId, newSession)
      await sendText(
        chatId,
        `✅ <b>Почти готово!</b>\n\n` +
        `✂️ ${session.service_name}\n` +
        `👨‍💈 ${session.employee_name}\n` +
        `📅 ${session.date} в ${time}\n\n` +
        `Как вас зовут? Введите имя:`,
      )
      return
    }

    return
  }

  // Text message
  if (update.message) {
    const msg = update.message as {
      chat: { id: number }
      from?: { first_name?: string }
      text?: string
      contact?: { phone_number: string }
    }
    const chatId = msg.chat.id
    const text = msg.text ?? ''
    const session = await getSession(chatId)

    // Commands
    if (text === '/start' || text === '/menu') {
      await showMainMenu(chatId)
      return
    }

    if (text === '/cancel' || text === 'Отмена') {
      await clearSession(chatId)
      await sendText(chatId, '❌ Отменено. Напишите /start чтобы начать снова.')
      return
    }

    if (text === '/today' && String(chatId) === ADMIN_CHAT_ID) {
      // Admin command: show today's appointments
      const today = new Date().toISOString().slice(0, 10)
      const { data: apts } = await supabase
        .from('appointments')
        .select('starts_at, status, clients(name, phone), services(name), employees(name)')
        .gte('starts_at', `${today}T00:00:00`)
        .lte('starts_at', `${today}T23:59:59`)
        .neq('status', 'cancelled')
        .order('starts_at')

      if (!apts?.length) {
        await sendText(chatId, '📭 Нет записей на сегодня.')
        return
      }

      let txt = `📋 <b>Записи на сегодня (${apts.length}):</b>\n\n`
      for (const a of apts) {
        const time = new Date(a.starts_at as string).toLocaleTimeString('ru', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty',
        })
        const client = (a.clients as { name: string; phone: string } | null)
        const svc = (a.services as { name: string } | null)?.name
        const emp = (a.employees as { name: string } | null)?.name?.split(' ')[0]
        const status = a.status === 'pending' ? '⏳' : a.status === 'confirmed' ? '✅' : '🏁'
        txt += `${status} <b>${time}</b> — ${client?.name} (${client?.phone})\n   ✂️ ${svc} · ${emp}\n\n`
      }
      await sendText(chatId, txt.trim())
      return
    }

    // Conversation steps
    if (session.step === 'name') {
      if (text.trim().length < 2) {
        await sendText(chatId, 'Введите ваше имя (минимум 2 символа):')
        return
      }
      const newSession: Session = { ...session, step: 'phone', name: text.trim() }
      await saveSession(chatId, newSession)
      await sendText(
        chatId,
        `Отлично, <b>${text.trim()}</b>!\n\nТеперь введите номер телефона:\n(например: +77001234567)`,
      )
      return
    }

    if (session.step === 'phone') {
      let phone = text.replace(/\D/g, '')
      if (phone.startsWith('8')) phone = '7' + phone.slice(1)
      if (phone.length < 10) {
        await sendText(chatId, 'Неверный формат. Введите телефон ещё раз:\n+77001234567')
        return
      }
      const normalizedPhone = '+' + phone

      // Create appointment
      const { data, error } = await supabase.functions.invoke('create-appointment', {
        body: {
          service_id: session.service_id,
          employee_id: session.employee_id,
          date: session.date,
          time: session.time,
          client_name: session.name,
          client_phone: normalizedPhone,
        },
      })

      if (error || !data?.appointment_id) {
        await sendText(
          chatId,
          '❌ Не удалось создать запись. Возможно, слот уже занят.\n\nНажмите /start чтобы выбрать другое время.',
        )
        await clearSession(chatId)
        return
      }

      await clearSession(chatId)
      await sendText(
        chatId,
        `🎉 <b>Запись создана!</b>\n\n` +
        `👤 ${session.name}\n` +
        `📞 ${normalizedPhone}\n` +
        `✂️ ${session.service_name}\n` +
        `👨‍💈 ${session.employee_name}\n` +
        `📅 ${session.date} в ${session.time}\n\n` +
        `Ждём вас! Если нужно отменить — напишите нам.`,
      )

      // Notify admin
      await notifyAdmin(
        `🆕 <b>Новая запись!</b>\n\n` +
        `👤 ${session.name} — ${normalizedPhone}\n` +
        `✂️ ${session.service_name}\n` +
        `👨‍💈 ${session.employee_name}\n` +
        `📅 ${session.date} в ${session.time}`,
      )
      return
    }

    // Default — show menu
    await showMainMenu(chatId)
  }
}

// ── HTTP handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  try {
    const update = await req.json()
    await handleUpdate(update)
  } catch (e) {
    console.error('TG webhook error:', e)
  }
  return new Response('ok')
})
