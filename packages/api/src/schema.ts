/**
 * API storage, split along Durable Object boundaries:
 *  - ORG_SCHEMA: one database per org (OrgDO on Cloudflare): the repo index, model keys and git tokens.
 *  - REPO_SCHEMA: one database per repository (RepoDO), next to that repo's coordinator
 *    tables (packages/core/src/schema.ts): tasks, swarms, and the read models the projector
 *    builds from coordinator events (agents, agent log, landings).
 */
export const ORG_SCHEMA = `
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  template TEXT,
  remote TEXT NOT NULL,
  clone_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (owner, name)
);

CREATE TABLE IF NOT EXISTS git_tokens (
  id TEXT PRIMARY KEY,
  person TEXT NOT NULL,
  name TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  last4 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS device_codes (
  device_hash TEXT PRIMARY KEY,
  user_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  person TEXT,
  sealed_token TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
  provider TEXT PRIMARY KEY,
  base_url TEXT,
  sealed TEXT NOT NULL,
  last4 TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  test TEXT
);
`;

export const REPO_SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  spec TEXT NOT NULL,
  kind TEXT NOT NULL,
  labels TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  swarm_id TEXT,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  seq INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_status ON tasks (status, seq);

CREATE TABLE IF NOT EXISTS swarms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  concurrency INTEGER NOT NULL,
  rules TEXT NOT NULL,
  budget TEXT NOT NULL,
  task_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  reason TEXT,
  final_counts TEXT,
  dispatched_by TEXT
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  swarm_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  worker TEXT NOT NULL,
  workcell TEXT NOT NULL,
  state TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  pin INTEGER,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  interrupts INTEGER NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  guards INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER,
  landed_version INTEGER,
  seat TEXT,
  claimed_by TEXT
);
CREATE INDEX IF NOT EXISTS agents_swarm ON agents (swarm_id);
CREATE INDEX IF NOT EXISTS agents_state ON agents (state);

CREATE TABLE IF NOT EXISTS agent_log (
  agent_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (agent_id, seq)
);

CREATE TABLE IF NOT EXISTS git_fetches (
  person TEXT PRIMARY KEY,
  sha TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS landings (
  version INTEGER PRIMARY KEY,
  sha TEXT NOT NULL,
  at INTEGER NOT NULL,
  title TEXT NOT NULL,
  by TEXT NOT NULL,
  change_order INTEGER NOT NULL DEFAULT 0,
  files TEXT NOT NULL,
  merged INTEGER NOT NULL DEFAULT 0,
  impact TEXT NOT NULL DEFAULT '[]',
  ci TEXT,
  approval TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** Columns added after a table was first created (applied once per database, ignoring "duplicate column"). */
export const REPO_MIGRATIONS = [
  `ALTER TABLE swarms ADD COLUMN final_counts TEXT`,
  `ALTER TABLE swarms ADD COLUMN dispatched_by TEXT`,
  `ALTER TABLE landings ADD COLUMN approval TEXT`,
  `ALTER TABLE agents ADD COLUMN seat TEXT`,
  `ALTER TABLE agents ADD COLUMN claimed_by TEXT`,
];
