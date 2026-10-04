/**
 * Public API v1: the repo-centric resources the CLI, MCP and web app use (docs/product-plan.md §3.1).
 * Internal coordinator/workcell types live in index.ts.
 */
import type { Approval, ChangeClass, Notice, Sha, Severity, TaskId, Version } from './index.js';

// ---------------------------------------------------------------- workers and models

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'openai-compatible';

export const PROVIDERS: Record<ProviderId, { label: string; defaultBaseUrl?: string }> = {
  anthropic: { label: 'Anthropic' },
  openai: { label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1' },
  gemini: { label: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  openrouter: { label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  'openai-compatible': { label: 'OpenAI-compatible' },
};

/** Who does the work: our tool loop on a provider's model, a replayed reference solution, or an external agent. */
export type Worker =
  | { kind: 'model'; provider: ProviderId; model: string }
  | { kind: 'scripted' }
  | { kind: 'external'; name: string };

export type TaskKindV1 = 'feature' | 'contract' | 'change-order';

/** Which worker takes which kind of task; the first matching rule wins, `default` matches everything. */
export interface ModelRule {
  when: TaskKindV1 | 'default';
  worker: Worker;
}

// ---------------------------------------------------------------- agents

export type AgentState =
  | 'queued'
  | 'working'
  | 'testing'
  | 'checkpointing'
  | 'interrupted'
  | 'guarded'
  | 'ready'
  | 'landed'
  | 'gave-up'
  | 'stopped'
  | 'error';

export const AGENT_STATES: AgentState[] = ['queued', 'working', 'testing', 'checkpointing', 'interrupted', 'guarded', 'ready', 'landed', 'gave-up', 'stopped', 'error'];
export const FINAL_AGENT_STATES: ReadonlySet<AgentState> = new Set(['landed', 'gave-up', 'stopped', 'error']);

export interface Cost {
  usd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface FileStat {
  path: string;
  class: ChangeClass;
  added: number;
  removed: number;
  status: 'added' | 'modified' | 'deleted';
}

export interface AgentSummary {
  id: string;
  repoId: string;
  swarmId: string;
  taskId: TaskId;
  taskTitle: string;
  worker: Worker;
  state: AgentState;
  /** one line: what it is doing or why it stopped */
  detail: string;
  pin: Version | null;
  writes: FileStat[];
  reads: number;
  notices: { interrupt: number; review: number };
  guards: number;
  toolCalls: number;
  cost: Cost;
  startedAt: number;
  updatedAt: number;
  finishedAt: number | null;
  landedVersion: Version | null;
}

export interface AgentStep {
  seq: number;
  tool: string;
  summary: string;
  ok: boolean;
  at: number;
}

export interface Guard {
  at: number;
  /** test files already on main that would have broken */
  tests: string[];
  failures: { file: string; name: string; message: string }[];
}

export interface NoticeV1 extends Notice {
  /** what the agent did after the notice, when known */
  outcome: string | null;
}

export interface AgentDetail extends AgentSummary {
  prompt: string;
  readSet: { path: string; changedSincePin: ChangeClass | null }[];
  noticeList: NoticeV1[];
  guardList: Guard[];
  checkpoints: { from: Version; to: Version; notices: number; at: number }[];
  testRuns: { at: number; passed: number; failed: number; ok: boolean }[];
  steps: AgentStep[];
  /** overlay vs current main (its own edits, rebased when main moved since its pin) */
  patches: FilePatch[];
}

// ---------------------------------------------------------------- diffs

export interface DiffLine {
  kind: 'ctx' | 'add' | 'del';
  old: number | null;
  new: number | null;
  text: string;
}

export interface Hunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FilePatch extends FileStat {
  hunks: Hunk[];
  /** merged automatically with concurrent landings (method) */
  merged?: string | null;
  binary?: boolean;
  /** overlay patches only: 'rebased' = its edits replayed onto a main that moved since its pin; 'pin' = they conflict with main, so shown against the pin */
  against?: 'rebased' | 'pin';
}

// ---------------------------------------------------------------- repositories

export type RepoSource =
  | { kind: 'hosted' }
  | { kind: 'imported'; url: string }
  | { kind: 'github'; repo: string; landing: 'pull-request' | 'direct'; branch: string };

export interface MainState {
  version: Version;
  sha: Sha;
  at: number;
}

export interface Repo {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  source: RepoSource;
  /** set for repos created from a template (e.g. the demo formula engine with its task bank) */
  template: string | null;
  /** may need credentials: POST /v1/repos/:owner/:name/clone-access returns a working URL */
  cloneUrl: string;
  createdAt: number;
  main: MainState | null;
  activity: {
    activeAgents: number;
    activeSwarms: number;
    /** overlays heading for main right now (ready or promoting) */
    approaching: number;
    landingsToday: number;
    guardsToday: number;
    lastLandingAt: number | null;
  };
}

/** A clone URL people can use now; `expiresAt` is set when it carries a short-lived token. */
export interface CloneAccess {
  url: string;
  expiresAt: string | null;
}

export interface CreateRepoRequest {
  name: string;
  description?: string;
  from: { kind: 'empty' } | { kind: 'template'; template: string } | { kind: 'import'; url: string } | { kind: 'github'; repo: string; landing: 'pull-request' | 'direct' };
}

export interface TreeEntry {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size: number | null;
  /** agents writing / reading this file (or anything under this directory) */
  writers: number;
  readers: number;
}

export interface MarginNote {
  agentId: string;
  taskTitle: string;
  state: AgentState;
  worker: Worker;
  class: ChangeClass;
  /** the hunk in main's line numbers where the change will land */
  hunk: Hunk;
}

export interface FileView {
  path: string;
  version: Version;
  content: string;
  lines: number;
  lastLanding: { version: Version; title: string; at: number } | null;
  writers: { agentId: string; taskTitle: string; state: AgentState }[];
  readers: number;
  notes: MarginNote[];
}

export interface Landing {
  version: Version;
  sha: Sha;
  at: number;
  title: string;
  by:
    | { kind: 'agent'; agentId: string; taskId: TaskId | null; swarmId: string | null; worker: Worker | null; /** who dispatched the swarm (the agent acted on their authority) */ delegatedBy: string | null }
    | { kind: 'human'; name: string; via: 'github' | 'push' }
    | { kind: 'seed' };
  changeOrder: boolean;
  files: FileStat[];
  merged: number;
  /** impact tests that ran before landing (empty when the change was purely additive) */
  impactTests: string[];
  ci: { passed: number; failed: number } | null;
  /** the policy this landing passed: a person approved its protected paths */
  approval: { by: string; paths: string[] } | null;
}

export interface LandingDetail extends Landing {
  patches: FilePatch[];
  /** agents this landing sent notices to */
  noticed: { agentId: string; severity: Severity; path: string }[];
}

// ---------------------------------------------------------------- tasks and swarms

export type TaskStatus = 'open' | 'queued' | 'running' | 'landed' | 'failed' | 'cancelled';

export interface TaskV1 {
  id: TaskId;
  repoId: string;
  title: string;
  prompt: string;
  kind: TaskKindV1;
  tests: string[];
  dependsOn: TaskId[];
  labels: string[];
  status: TaskStatus;
  swarmId: string | null;
  createdAt: number;
  source: 'user' | 'template';
}

export interface CreateTaskRequest {
  title: string;
  prompt?: string;
  kind?: TaskKindV1;
  tests?: string[];
  labels?: string[];
  dependsOn?: TaskId[];
}

export type SwarmStatus = 'running' | 'paused' | 'stopping' | 'finished' | 'stopped';

export interface Budget {
  maxUsd: number | null;
  maxMinutes: number | null;
}

export interface SwarmCounts {
  total: number;
  queued: number;
  running: number;
  landed: number;
  guarded: number;
  gaveUp: number;
  failed: number;
}

export interface Swarm {
  id: string;
  repoId: string;
  name: string;
  status: SwarmStatus;
  concurrency: number;
  rules: ModelRule[];
  budget: Budget;
  taskIds: TaskId[];
  counts: SwarmCounts;
  cost: Cost;
  /** projected cost at finish from the current per-task average */
  estimateUsd: number | null;
  createdAt: number;
  finishedAt: number | null;
  /** why it paused or stopped (budget, user, error) */
  reason: string | null;
  /** the person who dispatched it; its agents act on their authority */
  dispatchedBy: string | null;
}

export interface DispatchRequest {
  name?: string;
  taskIds?: TaskId[];
  /** create these tasks and dispatch them */
  newTasks?: CreateTaskRequest[];
  concurrency: number;
  rules: ModelRule[];
  budget?: Partial<Budget>;
}

export interface DispatchEstimate {
  tasks: number;
  usdLow: number;
  usdHigh: number;
  minutes: number;
  missingKeys: ProviderId[];
}

// ---------------------------------------------------------------- keys, session

export interface KeyInfo {
  provider: ProviderId;
  baseUrl: string | null;
  last4: string;
  addedAt: number;
  test: { at: number; ok: boolean; message: string; models: string[] } | null;
}

export interface SetKeyRequest {
  provider: ProviderId;
  key: string;
  baseUrl?: string;
}

export interface Session {
  user: { login: string; name: string };
  org: string;
  mode: 'local' | 'hosted';
}

/** What an external agent (Claude Code over `lm mcp`) receives when it claims a task. */
export interface ClaimedTask {
  agentId: string;
  swarmId: string;
  repo: string;
  task: { id: TaskId; title: string; prompt: string; tests: string[] };
  /** the working rules: how Live Main behaves and what done means */
  brief: string;
}

/** The result of one tool call by an external agent. */
export interface AgentToolResult {
  text: string;
  isError: boolean;
  landed: boolean;
}

/** Per-repo policy. */
export interface RepoPolicy {
  /** globs (`src/core/**`, `package.json`) whose changes by agents need a person's approval */
  protectedPaths: string[];
}

/** An approval as the web shows it. */
export interface ApprovalView extends Approval {
  taskTitle: string;
  swarmId: string | null;
}

/** A personal git token: HTTP Basic password for `git` against /git/:owner/:name.git. */
export interface GitToken {
  id: string;
  name: string;
  person: string;
  last4: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/** Device login for the CLI: show `userCode`, open `verificationUrl`, poll for the token. */
export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export type DeviceTokenResponse = { status: 'pending' } | { status: 'expired' } | { status: 'approved'; token: string; person: string };

/** The plaintext is returned once, at creation. */
export interface CreatedGitToken {
  token: string;
  info: GitToken;
}

// ---------------------------------------------------------------- events

/** Repo event stream (SSE): coordinator events plus API-level swarm/agent updates. */
export type RepoEvent =
  | { type: 'approval'; approval: ApprovalView }
  | { type: 'main'; main: MainState; landing: Landing }
  | { type: 'agent'; agent: AgentSummary }
  | { type: 'swarm'; swarm: Swarm }
  | { type: 'notice'; notice: Notice }
  | { type: 'ci'; version: Version; passed: number; failed: number };

export interface ApiError {
  error: string;
  message: string;
}
