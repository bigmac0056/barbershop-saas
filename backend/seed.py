#!/usr/bin/env python3
"""Seed BarberDom data. Run: python seed.py [--force]"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import init_db, SessionLocal, Employee, Service, EmployeeService, WorkSchedule


def seed(force: bool = False):
    init_db()
    db = SessionLocal()

    if db.query(Employee).count() > 0 and not force:
        print("Already seeded. Use --force to reseed.")
        db.close()
        return

    if force:
        print("🗑  Clearing old data...")
        db.query(EmployeeService).delete()
        db.query(WorkSchedule).delete()
        db.query(Service).delete()
        db.query(Employee).delete()
        db.commit()

    # ── Employee ──────────────────────────────────────────────
    adil = Employee(
        name="Адиль",
        bio="Профессиональный барбер · Любые стрижки и оформление бороды",
    )
    db.add(adil)
    db.flush()

    # ── Services (real BarberDom price list) ──────────────────
    services = [
        Service(name="Детская стрижка",               duration_min=20, price=3000),
        Service(name="Подростковая стрижка",           duration_min=25, price=3500),
        Service(name="Мужская стрижка",                duration_min=30, price=5000),
        Service(name="Стрижка + борода",               duration_min=60, price=8000),
        Service(name="Отдельно борода",                duration_min=20, price=4000),
        Service(name="Тонировка бороды",               duration_min=30, price=3500),
        Service(name="Побрить под 0",                  duration_min=20, price=2000),
        Service(name="Побрить под триммер",            duration_min=15, price=1000),
        Service(name="Помыть голову + укладка",        duration_min=20, price=2000),
    ]
    db.add_all(services)
    db.flush()

    # ── Employee ↔ Service links ──────────────────────────────
    for svc in services:
        db.add(EmployeeService(employee_id=adil.id, service_id=svc.id))

    # ── Schedule: every day 09:00–01:00, no days off ─────────
    for dow in range(7):  # 0=Mon … 6=Sun
        db.add(WorkSchedule(
            employee_id=adil.id,
            day_of_week=dow,
            start_time="09:00",
            end_time="01:00",   # 01:00 next day (handled in logic.py as overnight)
            is_day_off=False,
        ))

    db.commit()
    print("✅ BarberDom seed complete!")
    print(f"   Мастер: {adil.name}")
    print(f"   Услуг: {len(services)}")
    print("   График: Ежедневно 09:00–01:00")
    print("   Телефон: +7 771 475 5421")
    db.close()


if __name__ == "__main__":
    force = "--force" in sys.argv
    seed(force=force)
