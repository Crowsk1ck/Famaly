-- Record an in-game handoff separately from an accrued contract payout.
-- One confirmation per payout; no changes to treasury or payout amounts.
CREATE TABLE IF NOT EXISTS payout_confirmations (
  payout_id TEXT PRIMARY KEY REFERENCES payouts(id) ON DELETE RESTRICT,
  confirmed_by TEXT NOT NULL REFERENCES users(id),
  confirmed_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_payout_confirmed_at ON payout_confirmations(confirmed_at);
