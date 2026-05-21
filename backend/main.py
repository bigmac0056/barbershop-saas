import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from bot import handle_update, notify_admin
from db import Appointment, Client, Employee, EmployeeService, Service, get_db, init_db
from logic import compute_slots, create_appointment as _create, normalize_phone

# ── Config ─────────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "changeme-replace-with-random-in-production")
ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@barbershop.kz")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "changeme123")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Barbershop SaaS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# ── Auth ───────────────────────────────────────────────────────────────────────
def create_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24 * 7)
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") != ADMIN_EMAIL:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


class LoginReq(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
def login(req: LoginReq):
    if req.email != ADMIN_EMAIL or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_token(req.email), "token_type": "bearer"}


# ── Services ───────────────────────────────────────────────────────────────────
@app.get("/api/services")
def get_services(db: Session = Depends(get_db)):
    rows = db.query(Service).filter(Service.is_active == True).order_by(Service.price).all()
    return [
        {"id": s.id, "name": s.name, "duration_min": s.duration_min, "price": float(s.price), "is_active": s.is_active}
        for s in rows
    ]


# ── Employees ──────────────────────────────────────────────────────────────────
@app.get("/api/employees")
def get_employees(service_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    if service_id:
        links = db.query(EmployeeService).filter(EmployeeService.service_id == service_id).all()
        emp_ids = [l.employee_id for l in links]
        rows = db.query(Employee).filter(Employee.id.in_(emp_ids), Employee.is_active == True).all()
    else:
        rows = db.query(Employee).filter(Employee.is_active == True).all()
    return [
        {"id": e.id, "name": e.name, "photo_url": e.photo_url, "bio": e.bio, "is_active": e.is_active}
        for e in rows
    ]


# ── Slots ──────────────────────────────────────────────────────────────────────
@app.get("/api/slots")
def get_slots(
    employee_id: str = Query(...),
    date: str = Query(...),
    service_id: str = Query(...),
    db: Session = Depends(get_db),
):
    return {"slots": compute_slots(employee_id, date, service_id, db)}


# ── Appointments ───────────────────────────────────────────────────────────────
class CreateAppReq(BaseModel):
    service_id: str
    employee_id: str
    date: str
    time: str
    client_name: str
    client_phone: str
    notes: Optional[str] = None


def _apt_dict(a: Appointment) -> dict:
    return {
        "id": a.id,
        "client_id": a.client_id,
        "employee_id": a.employee_id,
        "service_id": a.service_id,
        "starts_at": a.starts_at.isoformat(),
        "ends_at": a.ends_at.isoformat(),
        "status": a.status,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "clients": (
            {"id": a.client.id, "name": a.client.name, "phone": a.client.phone,
             "created_at": a.client.created_at.isoformat() if a.client.created_at else None}
            if a.client else None
        ),
        "employees": (
            {"id": a.employee.id, "name": a.employee.name, "photo_url": a.employee.photo_url,
             "bio": a.employee.bio, "is_active": a.employee.is_active}
            if a.employee else None
        ),
        "services": (
            {"id": a.service.id, "name": a.service.name, "duration_min": a.service.duration_min,
             "price": float(a.service.price), "is_active": a.service.is_active}
            if a.service else None
        ),
    }


@app.post("/api/appointments")
def create_appointment(req: CreateAppReq, db: Session = Depends(get_db)):
    apt_id = _create(
        service_id=req.service_id,
        employee_id=req.employee_id,
        date_str=req.date,
        time_str=req.time,
        client_name=req.client_name,
        client_phone=req.client_phone,
        notes=req.notes,
        db=db,
    )
    if apt_id is None:
        raise HTTPException(status_code=409, detail="Slot already taken or service not found")

    try:
        svc = db.query(Service).filter(Service.id == req.service_id).first()
        emp = db.query(Employee).filter(Employee.id == req.employee_id).first()
        notify_admin(
            f"🆕 <b>Новая запись (сайт)!</b>\n\n"
            f"👤 {req.client_name} {normalize_phone(req.client_phone)}\n"
            f"✂️ {svc.name if svc else '?'}\n"
            f"👨‍💈 {emp.name if emp else '?'}\n"
            f"📅 {req.date} в {req.time}",
        )
    except Exception:
        pass

    return {"appointment_id": apt_id}


@app.get("/api/appointments")
def list_appointments(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: str = Depends(get_admin),
):
    query = db.query(Appointment).order_by(Appointment.starts_at)
    if date:
        day_start = datetime.strptime(date + "T00:00:00", "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        day_end = datetime.strptime(date + "T23:59:59", "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
        query = query.filter(Appointment.starts_at >= day_start, Appointment.starts_at <= day_end)
    return [_apt_dict(a) for a in query.all()]


@app.get("/api/appointments/{appointment_id}")
def get_appointment(appointment_id: str, db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    return _apt_dict(a)


class StatusReq(BaseModel):
    status: str


@app.patch("/api/appointments/{appointment_id}/status")
def update_status(
    appointment_id: str,
    req: StatusReq,
    db: Session = Depends(get_db),
    _: str = Depends(get_admin),
):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404)
    a.status = req.status
    db.commit()
    return {"ok": True}


@app.post("/api/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: str, db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404)
    a.status = "cancelled"
    db.commit()
    return {"ok": True}


# ── Clients ────────────────────────────────────────────────────────────────────
@app.get("/api/clients")
def list_clients(db: Session = Depends(get_db), _: str = Depends(get_admin)):
    rows = db.query(Client).order_by(Client.created_at.desc()).all()
    return [
        {"id": c.id, "name": c.name, "phone": c.phone,
         "created_at": c.created_at.isoformat() if c.created_at else None}
        for c in rows
    ]


# ── Telegram webhook ───────────────────────────────────────────────────────────
@app.post("/api/telegram/webhook")
def telegram_webhook(update: dict, db: Session = Depends(get_db)):
    try:
        handle_update(update, db)
    except Exception as e:
        print(f"Telegram webhook error: {e}")
    return {"ok": True}


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}
