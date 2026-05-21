import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from db import Service, WorkSchedule, BlockedSlot, Client, Appointment, EmployeeService


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8"):
        digits = "7" + digits[1:]
    return "+" + digits


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def compute_slots(employee_id: str, date_str: str, service_id: str, db: Session) -> List[str]:
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        return []

    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    dow = date_obj.weekday()  # 0=Mon, 6=Sun

    schedule = db.query(WorkSchedule).filter(
        WorkSchedule.employee_id == employee_id,
        WorkSchedule.day_of_week == dow,
    ).first()

    if not schedule or schedule.is_day_off:
        return []

    day_start = datetime(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = datetime(date_obj.year, date_obj.month, date_obj.day, 23, 59, 59, tzinfo=timezone.utc)

    existing = db.query(Appointment).filter(
        Appointment.employee_id == employee_id,
        Appointment.status != "cancelled",
        Appointment.starts_at >= day_start,
        Appointment.starts_at <= day_end,
    ).all()

    blocked = db.query(BlockedSlot).filter(
        BlockedSlot.employee_id == employee_id,
        BlockedSlot.starts_at >= day_start,
        BlockedSlot.starts_at <= day_end,
    ).all()

    busy = [
        (_ensure_utc(a.starts_at), _ensure_utc(a.ends_at))
        for a in existing + blocked
    ]

    start_h, start_m = map(int, schedule.start_time.split(":"))
    end_h, end_m = map(int, schedule.end_time.split(":"))
    start_minutes = start_h * 60 + start_m
    end_minutes = end_h * 60 + end_m
    duration = int(service.duration_min)

    slots: List[str] = []
    now = datetime.now(timezone.utc)
    is_today = date_obj == now.date()

    m = start_minutes
    while m + duration <= end_minutes:
        slot_h = m // 60
        slot_min = m % 60
        slot_start = datetime(date_obj.year, date_obj.month, date_obj.day, slot_h, slot_min, tzinfo=timezone.utc)
        slot_end = slot_start + timedelta(minutes=duration)

        if not (is_today and slot_start <= now):
            if not any(slot_start < b_end and slot_end > b_start for b_start, b_end in busy):
                slots.append(f"{slot_h:02d}:{slot_min:02d}")
        m += 30

    return slots


def create_appointment(
    service_id: str,
    employee_id: str,
    date_str: str,
    time_str: str,
    client_name: str,
    client_phone: str,
    notes: Optional[str],
    db: Session,
) -> Optional[str]:
    """Returns appointment_id on success, None if slot is taken or service missing."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        return None

    starts_at = datetime.strptime(f"{date_str}T{time_str}:00", "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    ends_at = starts_at + timedelta(minutes=int(service.duration_min))

    conflict = db.query(Appointment).filter(
        Appointment.employee_id == employee_id,
        Appointment.status != "cancelled",
        Appointment.starts_at < ends_at,
        Appointment.ends_at > starts_at,
    ).first()
    if conflict:
        return None

    phone = normalize_phone(client_phone)
    client = db.query(Client).filter(Client.phone == phone).first()
    if client:
        client.name = client_name
    else:
        client = Client(id=str(uuid.uuid4()), name=client_name, phone=phone)
        db.add(client)
    db.flush()

    appointment = Appointment(
        id=str(uuid.uuid4()),
        client_id=client.id,
        employee_id=employee_id,
        service_id=service_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status="pending",
        notes=notes,
    )
    db.add(appointment)
    db.commit()
    return appointment.id
