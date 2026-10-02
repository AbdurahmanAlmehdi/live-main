export const SCHEMA_VERSION = 1;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS versions (
  version INTEGER PRIMARY KEY,
  sha TEXT NOT NULL UNIQUE,
  parent INTEGER,
  promoted_by TEXT NOT NULL,
  task_id TEXT,
  change_order INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS version_paths (
  version INTEGER NOT NULL,
  path TEXT NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (version, path)
);
CREATE INDEX IF NOT EXISTS version_paths_path ON version_paths (path, version);

CREATE TABLE IF NOT EXISTS overlays (
  agent_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  strategy TEXT NOT NULL,
  workcell TEXT NOT NULL,
  pin INTEGER NOT NULL,
  status TEXT NOT NULL,
  write_set TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS overlay_reads (
  agent_id TEXT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (agent_id, path)
);
CREATE INDEX IF NOT EXISTS overlay_reads_path ON overlay_reads (path);

CREATE TABLE IF NOT EXISTS overlay_writes (
  agent_id TEXT NOT NULL,
  path TEXT NOT NULL,
  PRIMARY KEY (agent_id, path)
);
CREATE INDEX IF NOT EXISTS overlay_writes_path ON overlay_writes (path);

-- Test-impact index: which landed test files read which paths (from FUSE read sets).
CREATE TABLE IF NOT EXISTS landed_reads (
  path TEXT NOT NULL,
  test_file TEXT NOT NULL,
  PRIMARY KEY (path, test_file)
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  path TEXT NOT NULL,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  diff TEXT,
  merge_result TEXT,
  merge_method TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notices_agent ON notices (agent_id, id);

CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  type TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  paths TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  decided_by TEXT,
  decided_at INTEGER,
  note TEXT
);
CREATE INDEX IF NOT EXISTS approvals_agent ON approvals (agent_id, requested_at);

CREATE TABLE IF NOT EXISTS ci (
  version INTEGER PRIMARY KEY,
  sha TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  failing TEXT NOT NULL,
  at INTEGER NOT NULL
);
`;
