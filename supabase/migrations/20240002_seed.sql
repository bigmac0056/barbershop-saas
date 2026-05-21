-- =====================
-- SEED DATA
-- =====================

-- Services
INSERT INTO services (name, duration_min, price) VALUES
  ('Стрижка', 45, 3500),
  ('Борода', 30, 2500),
  ('Стрижка + Борода', 75, 5500),
  ('Детская стрижка', 30, 2500);

-- Employees
INSERT INTO employees (name, bio) VALUES
  ('Алибек Сейткали', 'Мастер с 5-летним опытом. Специализация: классика и фейд.'),
  ('Дамир Ахметов', 'Специалист по бородам и скин-фейду.');

-- Link all employees to all services
INSERT INTO employee_services (employee_id, service_id)
SELECT e.id, s.id FROM employees e, services s;

-- Work schedules (Mon-Sat, 10:00–20:00; Sun off)
INSERT INTO work_schedules (employee_id, day_of_week, start_time, end_time, is_day_off)
SELECT
  e.id,
  d.day,
  '10:00'::TIME,
  '20:00'::TIME,
  (d.day = 6)
FROM employees e, (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(day);
