import os
import uuid
from sqlalchemy import (
    create_engine, Column, String, Integer, Boolean,
    DateTime, Numeric, BigInteger, JSON, ForeignKey, Text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./barbershop.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def new_id() -> str:
    return str(uuid.uuid4())


class Employee(Base):
    __tablename__ = "employees"
    id = Column(String(36), primary_key=True, default=new_id)
    name = Column(String(200), nullable=False)
    photo_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Service(Base):
    __tablename__ = "services"
    id = Column(String(36), primary_key=True, default=new_id)
    name = Column(String(200), nullable=False)
    duration_min = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)


class EmployeeService(Base):
    __tablename__ = "employee_services"
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True)
    service_id = Column(String(36), ForeignKey("services.id", ondelete="CASCADE"), primary_key=True)


class WorkSchedule(Base):
    __tablename__ = "work_schedules"
    id = Column(String(36), primary_key=True, default=new_id)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"))
    day_of_week = Column(Integer, nullable=False)  # 0=Mon … 6=Sun
    start_time = Column(String(5), nullable=False)  # "HH:MM"
    end_time = Column(String(5), nullable=False)
    is_day_off = Column(Boolean, default=False)


class BlockedSlot(Base):
    __tablename__ = "blocked_slots"
    id = Column(String(36), primary_key=True, default=new_id)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="CASCADE"))
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String(500), nullable=True)


class Client(Base):
    __tablename__ = "clients"
    id = Column(String(36), primary_key=True, default=new_id)
    name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(String(36), primary_key=True, default=new_id)
    client_id = Column(String(36), ForeignKey("clients.id"))
    employee_id = Column(String(36), ForeignKey("employees.id"))
    service_id = Column(String(36), ForeignKey("services.id"))
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="pending")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("Client")
    employee = relationship("Employee")
    service = relationship("Service")


class TelegramSession(Base):
    __tablename__ = "telegram_sessions"
    chat_id = Column(BigInteger, primary_key=True)
    state = Column(JSON, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
