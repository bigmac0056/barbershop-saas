-- Хранит состояние диалога WhatsApp/Telegram для каждого пользователя
CREATE TABLE whatsapp_sessions (
  phone       TEXT PRIMARY KEY,            -- номер в формате 77XXXXXXXXX (без +)
  state       JSONB DEFAULT '{"step":"idle"}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Автоматически удаляем сессии старше 24 часов (через pg_cron или вручную)
CREATE INDEX idx_whatsapp_sessions_updated ON whatsapp_sessions(updated_at);
