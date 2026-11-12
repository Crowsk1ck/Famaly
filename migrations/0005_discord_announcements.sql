-- Add separately approved general announcements to Discord notifications.
-- Existing journal entries are preserved; no webhook credentials or private notices are copied.
INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
  ('discord_notify_announcements','true',datetime('now'));

CREATE TABLE IF NOT EXISTS discord_delivery_log_v5 (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('applications','decisions','events','capt','news','announcements','test')),
  status TEXT NOT NULL CHECK(status IN ('sent','failed')),
  http_status INTEGER,
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO discord_delivery_log_v5(id,kind,status,http_status,error_code,created_at)
SELECT id,kind,status,http_status,error_code,created_at FROM discord_delivery_log;
DROP TABLE discord_delivery_log;
ALTER TABLE discord_delivery_log_v5 RENAME TO discord_delivery_log;
CREATE INDEX IF NOT EXISTS idx_discord_delivery_date ON discord_delivery_log(created_at DESC);
