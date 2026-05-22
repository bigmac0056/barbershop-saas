import os
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from db import TelegramSession, Client, Appointment, Service, Employee, EmployeeService
from logic import compute_slots, create_appointment, normalize_phone

BOT_TOKEN      = os.environ.get("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID  = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
KASPI_NUMBER   = os.environ.get("KASPI_NUMBER", "+7 771 475 5421")

ALMATY = timezone(timedelta(hours=5))

SHOP_NAME    = "BarberDom"
SHOP_ADDRESS = "ул. Уральская, 42, Павлодар"
SHOP_HOURS   = "09:00 – 01:00 · Ежедневно"
SHOP_PHONE   = "+7 771 475 5421"
SHOP_INSTA   = "@barbershop.pvl"


# ── Telegram API helpers ──────────────────────────────────────────────────────

def tg(method: str, data: dict):
    if not BOT_TOKEN:
        return {}
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
            json=data,
            timeout=8,
        )
        return r.json()
    except Exception:
        return {}


def send_text(chat_id: int, text: str, **kwargs):
    tg("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML", **kwargs})


def send_buttons(chat_id: int, text: str, rows: list, **kwargs):
    tg("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": rows},
        **kwargs,
    })


def answer_cb(callback_query_id: str, text: str = ""):
    tg("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})


def notify_admin(text: str, reply_markup: dict | None = None):
    if not ADMIN_CHAT_ID:
        return
    payload: dict = {"chat_id": int(ADMIN_CHAT_ID), "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    tg("sendMessage", payload)


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

def show_main_menu(chat_id: int, db: Session, name: str = ""):
    greeting = f"Привет, <b>{name}</b>! 👋\n\n" if name else ""
    send_buttons(
        chat_id,
        f"{greeting}✂️ <b>{SHOP_NAME}</b> — барбершоп в Павлодаре\n\n"
        f"📍 {SHOP_ADDRESS}\n"
        f"🕐 {SHOP_HOURS}\n"
        f"📞 {SHOP_PHONE}\n\n"
        f"Выберите действие:",
        [[
            {"text": "✂️ Записаться", "callback_data": "start_book"},
            {"text": "📋 Мои записи", "callback_data": "my_bookings"},
        ]],
    )
    save_session(chat_id, {"step": "idle"}, db)


def show_services(chat_id: int, db: Session):
    services = db.query(Service).filter(Service.is_active == True).order_by(Service.price).all()
    if not services:
        send_text(chat_id, "Услуги временно недоступны.")
        return
    rows = [[{
        "text": f"{s.name}  —  {int(s.price):,} ₸".replace(",", " "),
        "callback_data": f"svc:{s.id}:{s.name}:{s.duration_min}:{int(s.price)}",
    }] for s in services]
    rows.append([{"text": "◀️ Назад", "callback_data": "back_main"}])
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
        send_text(chat_id, "Мастера временно недоступны.")
        return
    rows = [[{"text": f"👨‍💈 {e.name}", "callback_data": f"emp:{e.id}:{e.name}"}] for e in employees]
    rows.append([{"text": "◀️ Назад", "callback_data": "back_services"}])
    send_buttons(chat_id, "👨‍💈 <b>Выберите мастера:</b>", rows)
    save_session(chat_id, {**session, "step": "employee"}, db)


def show_dates(chat_id: int, session: dict, db: Session):
    today = datetime.now(ALMATY).date()
    rows = []
    for i in range(7):
        d = today + timedelta(days=i)
        iso = d.isoformat()
        day_labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        day_name = day_labels[d.weekday()]
        label = f"{'📅 Сегодня' if i == 0 else day_name} {d.strftime('%-d %b')}"
        rows.append([{"text": label, "callback_data": f"date:{iso}"}])
    rows.append([{"text": "◀️ Назад", "callback_data": "back_employees"}])
    send_buttons(chat_id, "📅 <b>Выберите дату:</b>", rows)
    save_session(chat_id, {**session, "step": "date"}, db)


def show_slots(chat_id: int, session: dict, db: Session):
    slots = compute_slots(session["employee_id"], session["date"], session["service_id"], db)
    if not slots:
        send_buttons(
            chat_id,
            "😔 <b>Нет свободных слотов на эту дату.</b>\n\nВыберите другую дату:",
            [[{"text": "📅 Выбрать другую дату", "callback_data": "back_dates"}],
             [{"text": "◀️ В начало", "callback_data": "back_main"}]],
        )
        return
    rows = []
    for i in range(0, len(slots), 4):
        rows.append([{"text": f"⏰ {s}", "callback_data": f"time:{s}"} for s in slots[i:i + 4]])
    rows.append([{"text": "◀️ Назад", "callback_data": "back_dates"}])

    # Parse date for display
    d = datetime.strptime(session["date"], "%Y-%m-%d")
    day_labels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
    date_display = f"{d.strftime('%-d')} {['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.month-1]} ({day_labels[d.weekday()]})"

    send_buttons(chat_id, f"⏰ <b>Свободное время на {date_display}:</b>", rows)
    save_session(chat_id, {**session, "step": "time"}, db)


def show_my_bookings(chat_id: int, db: Session):
    # Find client by their Telegram chat_id stored in appointments
    apts = (
        db.query(Appointment)
        .filter(
            Appointment.tg_chat_id == chat_id,
            Appointment.status.in_(["pending", "confirmed"]),
            Appointment.starts_at >= datetime.now(timezone.utc),
        )
        .order_by(Appointment.starts_at)
        .limit(5)
        .all()
    )

    if not apts:
        send_buttons(
            chat_id,
            "📭 <b>Активных записей нет.</b>\n\nЗапишитесь прямо сейчас!",
            [[{"text": "✂️ Записаться", "callback_data": "start_book"}]],
        )
        return

    text = "📋 <b>Ваши записи:</b>\n\n"
    for a in apts:
        dt = a.starts_at.astimezone(ALMATY)
        svc_name = a.service.name if a.service else "?"
        status_icon = "⏳" if a.status == "pending" else "✅"
        text += (
            f"{status_icon} <b>{dt.strftime('%d.%m')} в {dt.strftime('%H:%M')}</b>\n"
            f"   ✂️ {svc_name}\n\n"
        )

    send_buttons(
        chat_id,
        text.strip(),
        [[{"text": "✂️ Новая запись", "callback_data": "start_book"}]],
    )


def _admin_apt_list(date_str: str, db: Session) -> str:
    """Build text list of appointments for a given date."""
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    day_start = datetime(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = day_start + timedelta(hours=26)

    apts = (
        db.query(Appointment)
        .filter(
            Appointment.starts_at >= day_start,
            Appointment.starts_at < day_end,
            Appointment.status != "cancelled",
        )
        .order_by(Appointment.starts_at)
        .all()
    )

    day_labels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
    day_display = f"{date_obj.strftime('%-d')} {['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][date_obj.month-1]} ({day_labels[date_obj.weekday()]})"

    if not apts:
        return f"📭 Записей на <b>{day_display}</b> нет."

    txt = f"📋 <b>Записи на {day_display} ({len(apts)}):</b>\n\n"
    for a in apts:
        time_str = a.starts_at.astimezone(ALMATY).strftime("%H:%M")
        client_name = a.client.name if a.client else "?"
        client_phone = a.client.phone if a.client else "?"
        svc = a.service.name if a.service else "?"
        price = int(a.service.price) if a.service else 0
        icon = {"pending": "⏳", "confirmed": "✅", "completed": "🏁"}.get(a.status, "•")
        txt += (
            f"{icon} <b>{time_str}</b> — {client_name}\n"
            f"   📞 {client_phone}\n"
            f"   ✂️ {svc} · {price:,} ₸\n\n".replace(",", " ")
        )
    return txt.strip()


def show_today_admin(chat_id: int, db: Session):
    today = datetime.now(ALMATY).strftime("%Y-%m-%d")
    txt = _admin_apt_list(today, db)
    send_text(chat_id, txt)


# ── Payment request ───────────────────────────────────────────────────────────

def send_payment_request(apt_id: str, db: Session) -> str:
    """Send Kaspi payment request to client. Returns status message."""
    apt = db.query(Appointment).filter(Appointment.id == apt_id).first()
    if not apt:
        return "❌ Запись не найдена."

    if not apt.tg_chat_id:
        return "⚠️ Клиент записался через сайт, Telegram недоступен.\n\nОтправьте номер Kaspi вручную:\n💳 " + KASPI_NUMBER

    price = int(apt.service.price) if apt.service else 0
    svc_name = apt.service.name if apt.service else "услугу"

    send_text(
        apt.tg_chat_id,
        f"✂️ <b>Спасибо за визит в {SHOP_NAME}!</b>\n\n"
        f"Оплатите {price:,} ₸ за <i>{svc_name}</i>\n\n"
        f"💳 <b>Kaspi Pay:</b> {KASPI_NUMBER}\n"
        f"или по номеру телефона: <b>{KASPI_NUMBER}</b>\n\n"
        f"Будем рады видеть вас снова! 🙌".replace(",", " ")
    )
    return f"✅ Запрос на оплату отправлен клиенту ({price:,} ₸)".replace(",", " ")


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
        elif data == "back_main":
            show_main_menu(chat_id, db)
        elif data == "back_services":
            show_services(chat_id, db)
        elif data == "back_employees":
            show_employees(chat_id, session, db)
        elif data == "back_dates":
            show_dates(chat_id, session, db)

        elif data.startswith("svc:"):
            parts = data.split(":", 4)
            svc_id, svc_name, svc_dur, svc_price = parts[1], parts[2], parts[3], parts[4]
            show_employees(chat_id, {
                **session,
                "step": "employee",
                "service_id": svc_id,
                "service_name": svc_name,
                "service_duration": int(svc_dur),
                "service_price": int(svc_price),
            }, db)

        elif data.startswith("emp:"):
            parts = data.split(":", 2)
            emp_id, emp_name = parts[1], parts[2]
            show_dates(chat_id, {**session, "step": "date", "employee_id": emp_id, "employee_name": emp_name}, db)

        elif data.startswith("date:"):
            date = data.split(":", 1)[1]
            show_slots(chat_id, {**session, "step": "time", "date": date}, db)

        elif data.startswith("time:"):
            chosen_time = data.split(":", 1)[1]
            new_sess = {**session, "step": "name", "time": chosen_time}
            save_session(chat_id, new_sess, db)

            d = datetime.strptime(session["date"], "%Y-%m-%d")
            months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
            price = session.get("service_price", 0)
            send_text(
                chat_id,
                f"✅ <b>Почти готово!</b>\n\n"
                f"✂️ {session.get('service_name')} — {price:,} ₸\n"
                f"👨‍💈 {session.get('employee_name')}\n"
                f"📅 {d.strftime('%-d')} {months[d.month-1]} в <b>{chosen_time}</b>\n\n"
                f"Как вас зовут? Введите имя:".replace(",", " ")
            )

        elif data.startswith("pay_req:"):
            # Admin clicks "request payment" button
            apt_id = data.split(":", 1)[1]
            msg = send_payment_request(apt_id, db)
            send_text(int(ADMIN_CHAT_ID), msg)

        return

    if "message" in update:
        msg = update["message"]
        chat_id: int = msg["chat"]["id"]
        text: str = msg.get("text", "")
        first_name: str = msg.get("from", {}).get("first_name", "")
        session = get_session(chat_id, db)

        # ── Commands ──
        if text in ("/start", "/menu"):
            show_main_menu(chat_id, db, name=first_name)
            return

        if text in ("/cancel", "Отмена"):
            save_session(chat_id, {"step": "idle"}, db)
            send_text(chat_id, "❌ Отменено. Напишите /start чтобы начать.")
            return

        # ── Admin commands ──
        is_admin = str(chat_id) == str(ADMIN_CHAT_ID)

        if is_admin and text == "/today":
            show_today_admin(chat_id, db)
            return

        if is_admin and text.startswith("/day"):
            # /day 22.05 or /day 2026-05-22
            parts = text.split()
            if len(parts) >= 2:
                raw = parts[1]
                try:
                    if "." in raw:
                        d = datetime.strptime(raw, "%d.%m")
                        date_str = d.replace(year=datetime.now().year).strftime("%Y-%m-%d")
                    else:
                        date_str = raw
                    send_text(chat_id, _admin_apt_list(date_str, db))
                except Exception:
                    send_text(chat_id, "Формат: /day 22.05 или /day 2026-05-22")
            else:
                send_text(chat_id, "Формат: /day 22.05")
            return

        if is_admin and text.startswith("/week"):
            today = datetime.now(ALMATY)
            lines = []
            for i in range(7):
                d = today + timedelta(days=i)
                date_str = d.strftime("%Y-%m-%d")
                day_start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
                count = db.query(Appointment).filter(
                    Appointment.starts_at >= day_start,
                    Appointment.starts_at < day_start + timedelta(hours=26),
                    Appointment.status != "cancelled",
                ).count()
                day_labels = ["пн","вт","ср","чт","пт","сб","вс"]
                label = "Сегодня" if i == 0 else day_labels[d.weekday()]
                lines.append(f"📅 <b>{label} {d.strftime('%-d')}:</b> {count} зап.")
            send_text(chat_id, f"📊 <b>Неделя — {SHOP_NAME}:</b>\n\n" + "\n".join(lines))
            return

        if is_admin and text.startswith("/pay"):
            # /pay APT_ID — send payment request
            parts = text.split()
            if len(parts) >= 2:
                msg_out = send_payment_request(parts[1], db)
                send_text(chat_id, msg_out)
            else:
                send_text(chat_id, "Формат: /pay <ID_записи>")
            return

        # ── Booking flow ──
        if session.get("step") == "name":
            if len(text.strip()) < 2:
                send_text(chat_id, "Введите ваше имя (минимум 2 символа):")
                return
            save_session(chat_id, {**session, "step": "phone", "name": text.strip()}, db)
            send_text(
                chat_id,
                f"Отлично, <b>{text.strip()}</b>! 👍\n\n"
                f"Введите ваш номер телефона:\n"
                f"<i>Пример: +77001234567</i>",
            )
            return

        if session.get("step") == "phone":
            phone = normalize_phone(text)
            if len(phone) < 11:
                send_text(chat_id, "⚠️ Неверный формат. Введите телефон:\n+77001234567")
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
                tg_chat_id=chat_id,
            )

            if not apt_id:
                send_buttons(
                    chat_id,
                    "❌ <b>Слот уже занят.</b>\n\nВыберите другое время:",
                    [[{"text": "🔄 Выбрать другое время", "callback_data": "start_book"}]],
                )
                save_session(chat_id, {"step": "idle"}, db)
                return

            save_session(chat_id, {"step": "idle"}, db)

            price = session.get("service_price", 0)
            d = datetime.strptime(session["date"], "%Y-%m-%d")
            months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']

            send_text(
                chat_id,
                f"🎉 <b>Запись подтверждена!</b>\n\n"
                f"✂️ {session.get('service_name')} — {price:,} ₸\n"
                f"👨‍💈 {session.get('employee_name')}\n"
                f"📅 {d.strftime('%-d')} {months[d.month-1]} в <b>{session['time']}</b>\n"
                f"📍 {SHOP_ADDRESS}\n\n"
                f"Если нужно отменить — напишите нам в WhatsApp:\n{SHOP_PHONE}".replace(",", " ")
            )

            # Notify admin with payment request button
            notify_admin(
                f"🆕 <b>Новая запись!</b>\n\n"
                f"👤 {session['name']} · {phone}\n"
                f"✂️ {session.get('service_name')} — {price:,} ₸\n"
                f"📅 {d.strftime('%-d')} {months[d.month-1]} в <b>{session['time']}</b>".replace(",", " "),
                reply_markup={"inline_keyboard": [[
                    {"text": f"💳 Запросить оплату {price:,} ₸".replace(",", " "), "callback_data": f"pay_req:{apt_id}"},
                ]]},
            )
            return

        show_main_menu(chat_id, db, name=first_name)
