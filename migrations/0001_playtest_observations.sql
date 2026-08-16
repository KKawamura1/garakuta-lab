CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  game_version TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  saved_at TEXT NOT NULL,
  won INTEGER NOT NULL DEFAULT 0,
  reached INTEGER NOT NULL DEFAULT 0,
  final_hp INTEGER NOT NULL DEFAULT 0,
  replay_score INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  moment_count INTEGER NOT NULL DEFAULT 0,
  outcome_json TEXT NOT NULL,
  build_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  client_json TEXT NOT NULL,
  events_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  happened_at TEXT,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  phase TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_saved_at ON runs(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_run_seq ON moments(run_id, event_seq);
CREATE INDEX IF NOT EXISTS idx_moments_kind ON moments(kind);
