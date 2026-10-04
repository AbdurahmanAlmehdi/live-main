import type { ModelProvider, ToolOutcome } from '@livemain/agent';
import type { SqlStore, WorkcellClient } from '@livemain/core';
import type { ProviderId, Repo, RepoSource, Session, Solution, Task } from '@livemain/protocol';
import type { SwarmRunDeps } from './swarm-run.js';

/** Git hosting (Artifacts on Cloudflare, the workcell image's git server locally). */
export interface GitHost {
  /** create an empty repo; `remote` is the URL workcells use, `cloneUrl` the one people use */
  create(name: string): Promise<{ remote: string; cloneUrl: string }>;
  /** first commit of an empty repo with these files */
  initialCommit(name: string, files: Record<string, string>, message: string): Promise<string>;
  importUrl(name: string, url: string): Promise<string>;
  tree(name: string, ref: string): Promise<{ path: string; type: 'file' | 'dir'; size: number | null }[]>;
  /** null when the path does not exist at ref */
  file(name: string, ref: string, path: string): Promise<string | null>;
  log(name: string, ref: string, opts?: { path?: string; max?: number }): Promise<{ sha: string; parents: string[]; author: string; email: string; at: number; subject: string }[]>;
  /** unified patch of `to` against `from` (default: its first parent) */
  diff(name: string, to: string, from?: string): Promise<string>;
  /** hosts with per-repo credentials: a clone URL carrying a short-lived read token */
  cloneAccess?(name: string): Promise<{ url: string; expiresAt: string }>;
  /**
   * A smart-HTTP git request to the repo (`path` like `/info/refs?service=git-upload-pack`),
   * with the host's credentials for `access`. Backs the git gateway.
   */
  smartHttp?(name: string, access: 'read' | 'write', path: string, init?: RequestInit): Promise<Response>;
}

/** Repos created from a template come with a seed, a task list and (optionally) reference solutions. */
export interface Template {
  id: string;
  name: string;
  description: string;
  /** the seed as files or as a directory inside the integrator image */
  seed: { kind: 'dir'; dir: string } | { kind: 'files'; files: Record<string, string> };
  tasks: Task[];
  /** reference solutions: enables the scripted worker (deterministic demo, no model keys) */
  solution?(taskId: string, naive?: boolean): Solution | undefined | Promise<Solution | undefined>;
}

/** Encrypts provider keys at rest; plaintext only ever exists in the agent runner's memory. */
export interface KeyVault {
  seal(plaintext: string): Promise<string>;
  open(sealed: string): Promise<string>;
}

/** What the org knows about a repository; the repo's own state lives with the repo. */
export interface RepoRecord {
  id: string;
  owner: string;
  name: string;
  description: string;
  source: RepoSource;
  template: string | null;
  remote: string;
  cloneUrl: string;
  createdAt: number;
}

/** Model keys as a repo sees them: owned by the org, decrypted only to build a provider. */
export interface ModelKeys {
  /** the providers in `wanted` that have no key */
  missing(wanted: ProviderId[]): Promise<ProviderId[]>;
  provider(id: ProviderId): Promise<ModelProvider>;
}

/** A running swarm, however it is executed (in process locally, alarm-driven on Durable Objects). */
export interface SwarmHandle {
  pause(reason?: string): void;
  resume(): void;
  stop(): void;
  stopAgent(agentId: string): boolean;
  /** external agents (seats): a client claimed this agent; start its idle clock */
  claimed(agentId: string): Promise<void> | void;
  /** external agents: run one tool call on the agent's session (`give_up` ends it) */
  tool(agentId: string, name: string, input: Record<string, unknown>): Promise<ToolOutcome>;
  readonly done: Promise<void>;
}

/**
 * Runs swarms. In process locally (a swarm lives as long as the process); durable on Durable
 * Objects, where a swarm outlives any one instance of the repo service and is reattached.
 */
export interface SwarmRunner {
  start(deps: SwarmRunDeps): SwarmHandle;
  /** durable runners: the handle of a swarm started by an earlier instance */
  attach?(swarmId: string): SwarmHandle | null;
  /** swarms survive a restart of the repo service (so it must not mark them stopped) */
  readonly durable?: boolean;
}

/** Everything a repository's service needs; one per repo (RepoDO on Cloudflare). */
export interface RepoDeps {
  record: RepoRecord;
  sql: SqlStore;
  git: GitHost;
  integrator: WorkcellClient;
  workcells: { name: string; client: WorkcellClient }[];
  template?: Template;
  keys: ModelKeys;
  runner?: SwarmRunner;
  now?: () => number;
  log?: (line: string) => void;
  /** scripted workers: simulated model latency per tool call (ms) */
  thinkMs?: number;
  /** the install's user: who acts when a request carries no signed-in person (local runtime) */
  user?: string;
}

/** How the org reaches its repositories (in process locally, RPC to RepoDOs on Cloudflare). */
export interface RepoHost {
  /** set up a new repository's live main at its first commit */
  init(record: RepoRecord, seed: { sha: string; title: string; tasks: Task[] }): Promise<void>;
  view(record: RepoRecord): Promise<Repo>;
}

export interface OrgDeps {
  sql: SqlStore;
  git: GitHost;
  /** seeds template repos from a directory in the integrator image */
  integrator: WorkcellClient;
  vault: KeyVault;
  templates: Template[];
  session: Session;
  repos: RepoHost;
  now?: () => number;
}

/** The local runtime: one process, Docker workcells, a database file per org and per repo. */
export interface Platform {
  git: GitHost;
  /** storage: `org` and `repo-<id>` databases */
  sql(name: string): SqlStore;
  integrator: WorkcellClient;
  workcells: { name: string; client: WorkcellClient }[];
  vault: KeyVault;
  templates: Template[];
  session: Session;
  now?: () => number;
  log?: (line: string) => void;
}
