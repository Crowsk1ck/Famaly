PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', game_id TEXT NOT NULL DEFAULT '',
  discord TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('leader','deputy','head','member')),
  permissions TEXT NOT NULL DEFAULT '[]', rank_id INTEGER, department_id TEXT,
  joined_at TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked')),
  activity TEXT NOT NULL DEFAULT 'Не вказано', version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  revoked_at TEXT, user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, blocked_until TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ranks (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, requirements TEXT NOT NULL DEFAULT '',
  checklist TEXT NOT NULL DEFAULT '[]', is_example INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, head_id TEXT,
  version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY, nickname TEXT NOT NULL, game_id TEXT NOT NULL,
  discord TEXT NOT NULL DEFAULT '', experience TEXT NOT NULL DEFAULT '', motivation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'На перевірці', comment TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY, module TEXT NOT NULL, title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Заплановано',
  owner_id TEXT NOT NULL, assignee_id TEXT, department_id TEXT,
  amount INTEGER NOT NULL DEFAULT 0, starts_at TEXT NOT NULL DEFAULT '', ends_at TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '[]', extra TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_module ON records(module, deleted_at, created_at);
CREATE INDEX IF NOT EXISTS idx_records_owner ON records(owner_id, module);
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL, treasury_percent INTEGER NOT NULL DEFAULT 20,
  participant_ids TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'Заплановано',
  evidence TEXT NOT NULL DEFAULT '[]', settled_at TEXT,
  owner_id TEXT NOT NULL, department_id TEXT, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES contracts(id),
  user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(contract_id,user_id)
);
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('treasury','contribution','expense','bonus','capt')),
  amount INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '', reference TEXT UNIQUE,
  actor_id TEXT NOT NULL, recipient_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id, read_at);
CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL,
  action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit(created_at);

INSERT OR IGNORE INTO departments(id,title,head_id,updated_at) VALUES
  ('capt','CAPT-склад',NULL,datetime('now')),
  ('farm','Фарм',NULL,datetime('now')),
  ('fleet','Автопарк',NULL,datetime('now')),
  ('discipline','Дисципліна',NULL,datetime('now')),
  ('recruitment','Рекрутинг',NULL,datetime('now')),
  ('events','Івенти',NULL,datetime('now'));

INSERT OR IGNORE INTO ranks(id,title,requirements,checklist,is_example,updated_at) VALUES
  (1,'Ранг 01 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (2,'Ранг 02 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (3,'Ранг 03 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (4,'Ранг 04 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (5,'Ранг 05 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (6,'Ранг 06 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (7,'Ранг 07 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (8,'Ранг 08 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (9,'Ранг 09 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (10,'Ранг 10 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (11,'Ранг 11 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (12,'Ранг 12 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (13,'Ранг 13 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (14,'Ранг 14 — приклад','Умови встановлює керівник','[]',1,datetime('now')),
  (15,'Ранг 15 — приклад','Умови встановлює керівник','[]',1,datetime('now'));

INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
  ('family_name','GRIZZLY',datetime('now')),
  ('tagline','Сила в єдності. Повага — у вчинках.',datetime('now')),
  ('history','Сім’я Grizzly об’єднує гравців, які цінують командну гру, дисципліну та взаємодопомогу у світі GTA 5 RP.',datetime('now')),
  ('discord_url','',datetime('now')),
  ('rules','Поважай учасників і правила сервера. Дотримуйся субординації. Виконуй взяті завдання. Конфлікти вирішуй через керівництво. (Редагований приклад)',datetime('now')),
  ('requirements','Адекватність, командна гра, активність і бажання розвивати сім’ю. (Редагований приклад)',datetime('now')),
  ('treasury_percent','20',datetime('now')),
  ('capt_afk_rate','100000',datetime('now')),
  ('capt_battle_rate','200000',datetime('now'));

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id TEXT NOT NULL REFERENCES records(id), user_id TEXT NOT NULL REFERENCES users(id),
  response TEXT NOT NULL CHECK(response IN ('Так','Ні')), updated_at TEXT NOT NULL,
  PRIMARY KEY(event_id,user_id)
);
