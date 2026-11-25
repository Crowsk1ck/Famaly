-- v17.2: public self-registration requests require explicit leader approval.
-- No public registration can create an active family session or a privileged role.
ALTER TABLE users ADD COLUMN telegram TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS account_registrations (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT,
  nickname TEXT NOT NULL,
  game_id TEXT NOT NULL,
  discord TEXT NOT NULL DEFAULT '',
  telegram TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Очікує' CHECK(status IN ('Очікує','Прийнято','Відхилено')),
  version INTEGER NOT NULL DEFAULT 1,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_registrations_pending_username
  ON account_registrations(username COLLATE NOCASE) WHERE status='Очікує';
CREATE INDEX IF NOT EXISTS idx_account_registrations_status_created
  ON account_registrations(status,created_at DESC);
