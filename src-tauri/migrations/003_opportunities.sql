CREATE TABLE IF NOT EXISTS scout_records (
 id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scout_records_updated ON scout_records(updated_at);
PRAGMA user_version=3;
