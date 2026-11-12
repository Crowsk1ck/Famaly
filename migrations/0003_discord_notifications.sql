-- GRIZZLY Discord notifications: persistent leader preferences and delivery outcome log.
-- No webhook credentials or applicant data are stored in these tables.
INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
  ('discord_notify_applications','true',datetime('now')),
  ('discord_notify_decisions','true',datetime('now')),
  ('discord_notify_events','true',datetime('now'));

CREATE TABLE IF NOT EXISTS discord_delivery_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('applications','decisions','events','test')),
  status TEXT NOT NULL CHECK(status IN ('sent','failed')),
  http_status INTEGER,
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discord_delivery_date ON discord_delivery_log(created_at DESC);
