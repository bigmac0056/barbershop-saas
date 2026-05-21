import os
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from db import TelegramSession, Client, Appointment, Service, Employee, EmployeeService
from logic import compute_slots, create_appointment, normalize_phone

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")

ALMATY = timezone(timedelta(hours=5))


# ── Telegram API helpers ──────────────────────────────────────────────────────

def tg(method: str, data: dict):
    if not BOT_TOKEN:
        return
    try:
        httpx.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
            json=data,
            timeout=8,
        )
    except Exception:
        pass


def send_text(chat_id: int, text: str, **kwargs):
    tg("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML", **kwargs})


def send_buttons(chat_id: int, text: str, rows: list):
    tg("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": rows},
    })


def answer_cb(callback_query_id: str):
    tg("answerCallbackQuery", {"callback_query_id": callback_query_id})


def notify_admin(text: str):
    if ADMIN_CHAT_ID:
        send_text(int(ADMIN_CHAT_ID), text)


# ── Session helpers ───────────────────────────────────────────────────────────

def get_session(chat_id: int, db: Session) -> dict:
    sess = db.query(TelegramSession).filter(TelegramSession.chat_id == chat_id).first()
    return dict(sess.state) if sess and sess.state else {"step": "idle"}


def save_session(chat_id: int, state: dict, db: Session):
    sess = db.query(TelegramSession).filter(TelegramSession.chat_id == chat_id).first()
    if sess:
        sess.state = state
        sess.updated_at = datetime.now(timezone.utc)
    else:
        sess = TelegramSession(chat_id=chat_id, state=state)
        db.add(sess)
    db.commit()


# ── Screens ───────────────────────────────────────────────────────────────────

def show_main_menu(chat_id: int, db: Session):
    send_buttons(chat_id, "👋 <b>Барбершоп</b>\n\nВыберите действие:", [[
        {"text": "✂️ Записаться", "callback_data": "start_book"},
        {"text": "📋 Мои записи", "callback_data": "my_bookings"},
    ]])
    save_session(chat_id, {"step": "idle"}, db)


def show_services(chat_id: int, db: Session):
    services = db.query(Service).filter(Service.is_active == True).order_by(Service.price).all()
    if not services:
        send_text(chat_id, "Услуги временно недоступны.")
        return
    rows = [[{
        "text": f"{s.name} — {int(s.price):,} ₸ ({s.duration_min} мин)".replace(",", " "),
        "callback_data": f"svc:{s.id}:{s.name}:{s.duration_min}",
    }] for s in services]
    send_buttons(chat_id, "✂️ <b>Выберите услугу:</b>", rows)
    save_session(chat_id, {"step": "service"}, db)


def show_employees(chat_id: int, session: dict, db: Session):
    service_id = session.get("service_id")
    links = db.query(EmployeeService).filter(EmployeeService.service_id == service_id).all()
    emp_ids = [l.employee_id for l in links]
    employees = db.query(Employee).filter(
        Employee.id.in_(emp_ids), Employee.is_active == True
    ).all()
    if not employees:
        send_text(chat_id, "Нет доступных мастеров.")
        return
    rows = [[{"text": f"👨‍💈 {e.name}", "callback_data": f"emp:{e.id}:{e.name}"}] for e in employees]
    send_buttons(chat_id, "👨‍💈 <b>Выберите мастера:</b>", rows)
    save_session(chat_id, {**session, "step": "employee"}, db)


def show_dates(chat_id: int, session: dict, db: Session):
    today = datetime.now(timezone.utc).date()
    rows = []
    for i in range(7):
        d = today + timedelta(days=i)
        iso = d.isoformat()
        label = d.strftime("%a, %d %b")
        prefix = "📅 Сегодня" if i == 0 else "📅"
        rows.append([{"text": f"{prefix} ({label})", "callback_data": f"date:{iso}"}])
    send_buttons(chat_id, "📅 <b>Выберите дату:</b>", rows)
    save_session(chat_id, {**session, "step": "date"}, db)


def show_slots(chat_id: int, session: dict, db: Session):
    slots = compute_slots(session["employee_id"], session["date"], session["service_id"], db)
    if not slots:
        send_text(chat_id, "😔 Нет свободных слотов на эту дату.\n\nВыберите другую дату:")
        show_dates(chat_id, session, db)
        return
    rows = []
    for i in range(0, len(slots), 3):
        rows.append([{"text": f"⏰ {s}", "callback_data": f"time:{s}"} for s in slots[i:i + 3]])
    send_buttons(chat_id, f"⏰ <b>Свободное время на {session['date']}:</b>", rows)
    save_session(chat_id, {**session, "step": "time"}, db)


def show_my_bookings(chat_id: int, db: Session):
    tg_phone = f"tg:{chat_id}"
    client = db.query(Client).filter(Client.phone == tg_phone).first()
    if not client:
        send_text(chat_id, "😕 У вас нет записей.\n\nЧтобы записаться, нажмите /start")
        return

    apts = (
        db.query(Appointment)
        .filter(Appointment.client_id == client.id, Appointment.status.in_(["pending", "confirmed"]))
        .order_by(Appointment.starts_at)
        .limit(5)
        .all()
    )

    if not apts:
        send_text(chat_id, "📭 Активных записей нет.\n\n/start — записаться")
        return

    text = "📋 <b>Ваши записи:</b>\n\n"
    for a in apts:
        dt = a.starts_at.astimezone(ALMATY)
        svc_name = a.service.name if a.service else "?"
        emp_name = a.employee.name if a.employee else "?"
        status = "⏳ ожидает" if a.status == "pending" else "✅ подтверждена"
        text += f"📅 {dt.strftime('%d.%m.%Y')} в {dt.strftime('%H:%M')}\n✂️ {svc_name} · {emp_name}\n{status}\n\n"

    send_buttons(chat_id, text.strip(), [[{"text": "✂️ Новая запись", "callback_data": "start_book"}]])


def show_today_admin(chat_id: int, db: Session):
    today = datetime.now(timezone.utc).date()
    day_start = datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc)

    apts = (
        db.query(Appointment)
        .filter(
            Appointment.starts_at >= day_start,
            Appointment.starts_at <= day_end,
            Appointment.status != "cancelled",
        )
        .order_by(Appointment.starts_at)
        .all()
    )

    if not apts:
        send_text(chat_id, "📭 Нет записей на сегодня.")
        return

    txt = f"📋 <b>Записи на сегодня ({len(apts)}):</b>\n\n"
    for a in apts:
        time_str = a.starts_at.astimezone(ALMATY).strftime("%H:%M")
        client_name = a.client.name if a.client else "?"
        client_phone = a.client.phone if a.client else "?"
        svc = a.service.name if a.service else "?"
        emp = a.employee.name.split()[0] if a.employee else "?"
        icon = {"pending": "⏳", "confirmed": "✅", "completed": "🏁"}.get(a.status, "•")
        txt += f"{icon} <b>{time_str}</b> — {client_name} ({client_phone})\n   ✂️ {svc} · {emp}\n\n"

    send_text(chat_id, txt.strip())


# ── Main handler ──────────────────────────────────────────────────────────────

def handle_update(update: dict, db: Session):
    if "callback_query" in update:
        cq = update["callback_query"]
        chat_id: int = cq["from"]["id"]
        data: str = cq.get("data", "")
        session = get_session(chat_id, db)
        answer_cb(cq["id"])

        if data == "start_book":
            show_services(chat_id, db)
        elif data == "my_bookings":
            show_my_bookings(chat_id, db)
        elif data.startswith("svc:"):
            parts = data.split(":", 3)
            svc_id, svc_name, svc_dur = parts[1], parts[2], parts[3]
            show_employees(chat_id, {
                **session,
                "step": "employee",
                "service_id": svc_id,
                "service_name": svc_name,
                "service_duration": int(svc_dur),
            }, db)
        elif data.startswith("emp:"):
            parts = data.split(":", 2)
            emp_id, emp_name = parts[1], parts[2]
            show_dates(chat_id, {**session, "step": "date", "employee_id": emp_id, "employee_name": emp_name}, db)
        elif data.startswith("date:"):
            date = data.split(":", 1)[1]
            show_slots(chat_id, {**session, "step": "time", "date": date}, db)
        elif data.startswith("time:"):
            time = data.split(":", 1)[1]
            new_sess = {**session, "step": "name", "time": time}
            save_session(chat_id, new_sess, db)
            send_text(
                chat_id,
                f"✅ <b>Почти готово!</b>\n\n"
                f"✂️ {session.get('service_name')}\n"
                f"👨‍💈 {session.get('employee_name')}\n"
                f"📅 {session.get('date')} в {time}\n\n"
                f"Как вас зовут? Введите имя:",
            )
        return

    if "message" in update:
        msg = update["message"]
        chat_id: int = msg["chat"]["id"]
        text: str = msg.get("text", "")
        session = get_session(chat_id, db)

        if text in ("/start", "/menu"):
            show_main_menu(chat_id, db)
            return

        if text in ("/cancel", "Отмена"):
            save_session(chat_id, {"step": "idle"}, db)
            send_text(chat_id, "❌ Отменено. Напишите /start чтобы начать снова.")
            return

        if text == "/today" and str(chat_id) == ADMIN_CHAT_ID:
            show_today_admin(chat_id, db)
            return

        if session.get("step") == "name":
            if len(text.strip()) < 2:
                send_text(chat_id, "Введите ваше имя (минимум 2 символа):")
                return
            save_session(chat_id, {**session, "step": "phone", "name": text.strip()}, db)
            send_text(
                chat_id,
                f"Отлично, <b>{text.strip()}</b>!\n\nТеперь введите номер телефона:\n(например: +77001234567)",
            )
            return

        if session.get("step") == "phone":
            phone = normalize_phone(text)
            if len(phone) < 11:
                send_text(chat_id, "Неверный формат. Введите телефон ещё раз:\n+77001234567")
                return

            apt_id = create_appointment(
                service_id=session["service_id"],
                employee_id=session["employee_id"],
                date_str=session["date"],
                time_str=session["time"],
                client_name=session["name"],
                client_phone=phone,
                notes=None,
                db=db,
            )

            if not apt_id:
                send_text(
                    chat_id,
                    "❌ Не удалось создать запись. Возможно, слот уже занят.\n\nНажмите /start чтобы выбрать другое время.",
                )
                save_session(chat_id, {"step": "idle"}, db)
                return

            save_session(chat_id, {"step": "idle"}, db)
            send_text(
                chat_id,
                f"🎉 <b>Запись создана!</b>\n\n"
                f"👤 {session['name']}\n"
                f"📞 {phone}\n"
                f"✂️ {session.get('service_name')}\n"
                f"👨‍💈 {session.get('employee_name')}\n"
                f"📅 {session['date']} в {session['time']}\n\n"
                f"Ждём вас! Если нужно отменить — напишите нам.",
            )
            notify_admin(
                f"🆕 <b>Новая запись (Telegram)!</b>\n\n"
                f"👤 {session['name']} — {phone}\n"
                f"✂️ {session.get('service_name')}\n"
                f"👨‍💈 {session.get('employee_name')}\n"
                f"📅 {session['date']} в {session['time']}",
            )
            return

        show_main_menu(chat_id, db)
