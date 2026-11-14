-- Durable Discord outbox. No webhook URL or token is stored here.
-- The migration only creates a new table; it does not alter finance, records or R2.
CREATE TABLE IF NOT EXISTS discord_outbox (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL,
 route TEXT NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','sending','sent','failed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 available_at TEXT NOT NULL,
 lease_until TEXT,
 last_error TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discord_outbox_pending
 ON discord_outbox(status,available_at);
CREATE INDEX IF NOT EXISTS idx_discord_outbox_created
 ON discord_outbox(created_at DESC);
