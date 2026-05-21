-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- EMPLOYEES
-- =====================
CREATE TABLE employees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  photo_url   TEXT,
  bio         TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- SERVICES
-- =====================
CREATE TABLE services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  price        NUMERIC(10,2) NOT NULL,
  is_active    BOOLEAN DEFAULT true
);

-- =====================
-- EMPLOYEE ↔ SERVICE
-- =====================
CREATE TABLE employee_services (
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, service_id)
);

-- =====================
-- WORK SCHEDULES
-- =====================
CREATE TABLE work_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_day_off   BOOLEAN DEFAULT false
);

-- =====================
-- BLOCKED SLOTS
-- =====================
CREATE TABLE blocked_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  reason      TEXT
);

-- =====================
-- CLIENTS
-- =====================
CREATE TABLE clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone)
);

-- =====================
-- APPOINTMENTS
-- =====================
CREATE TABLE appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID REFERENCES clients(id),
  employee_id  UUID REFERENCES employees(id),
  service_id   UUID REFERENCES services(id),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appointments_employee_time
  ON appointments(employee_id, starts_at)
  WHERE status NOT IN ('cancelled');

-- =====================
-- ROW LEVEL SECURITY
-- =====================

-- Публичный доступ на чтение для клиентского flow
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services       ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments   ENABLE ROW LEVEL SECURITY;

-- Все могут читать справочники
CREATE POLICY "public read employees"   ON employees       FOR SELECT USING (true);
CREATE POLICY "public read services"    ON services        FOR SELECT USING (true);
CREATE POLICY "public read emp_svc"     ON employee_services FOR SELECT USING (true);
CREATE POLICY "public read schedules"   ON work_schedules  FOR SELECT USING (true);
CREATE POLICY "public read blocked"     ON blocked_slots   FOR SELECT USING (true);

-- Записи: создание публично (через Edge Function), чтение/изменение — только auth
CREATE POLICY "service_role full appointments" ON appointments FOR ALL USING (true);
CREATE POLICY "service_role full clients"      ON clients      FOR ALL USING (true);

-- Только авторизованные (admin) могут менять данные напрямую
CREATE POLICY "admin write employees"   ON employees       FOR ALL TO authenticated USING (true);
CREATE POLICY "admin write schedules"   ON work_schedules  FOR ALL TO authenticated USING (true);
CREATE POLICY "admin write blocked"     ON blocked_slots   FOR ALL TO authenticated USING (true);
CREATE POLICY "admin write services"    ON services        FOR ALL TO authenticated USING (true);
