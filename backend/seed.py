#!/usr/bin/env python3
"""Seed initial data. Run once: python seed.py"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import init_db, SessionLocal, Employee, Service, EmployeeService, WorkSchedule


def seed():
    init_db()
    db = SessionLocal()

    if db.query(Employee).count() > 0:
        print("Already seeded. Skipping.")
        db.close()
        return

    # Employees
    e1 = Employee(name="Алибек Жаксыбеков", bio="Специалист по классическим стрижкам, 5 лет опыта")
    e2 = Employee(name="Данияр Сейткали", bio="Мастер fade и текстурных причёсок")
    db.add_all([e1, e2])
    db.flush()

    # Services
    s1 = Service(name="Мужская стрижка", duration_min=30, price=3500)
    s2 = Service(name="Стрижка + борода", duration_min=60, price=6000)
    s3 = Service(name="Укладка", duration_min=20, price=2000)
    s4 = Service(name="Детская стрижка", duration_min=30, price=2500)
    db.add_all([s1, s2, s3, s4])
    db.flush()

    # Employee ↔ Service links
    for svc in [s1, s2, s3, s4]:
        db.add(EmployeeService(employee_id=e1.id, service_id=svc.id))
        db.add(EmployeeService(employee_id=e2.id, service_id=svc.id))

    # Work schedules: Mon–Sat 10:00–20:00, Sunday off
    for emp in [e1, e2]:
        for dow in range(6):  # Mon=0 … Sat=5
            db.add(WorkSchedule(
                employee_id=emp.id,
                day_of_week=dow,
                start_time="10:00",
                end_time="20:00",
                is_day_off=False,
            ))
        db.add(WorkSchedule(
            employee_id=emp.id,
            day_of_week=6,  # Sunday
            start_time="10:00",
            end_time="20:00",
            is_day_off=True,
        ))

    db.commit()
    print("✅ Seed complete!")
    print(f"  Employees: {e1.name}, {e2.name}")
    print("  Services: Мужская стрижка, Стрижка+борода, Укладка, Детская")
    print("  Schedule: Пн–Сб 10:00–20:00, Вс — выходной")
    db.close()


if __name__ == "__main__":
    seed()
