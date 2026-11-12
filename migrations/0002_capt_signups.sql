-- CAPT match registration, one row per user and match. No sample people or results.
CREATE TABLE IF NOT EXISTS capt_signups (
  match_id TEXT NOT NULL REFERENCES records(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (match_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_capt_signups_match ON capt_signups(match_id,joined_at,user_id);
CREATE INDEX IF NOT EXISTS idx_capt_signups_user ON capt_signups(user_id);
