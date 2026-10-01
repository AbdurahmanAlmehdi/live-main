/**
 * Shared types for Live Main: coordinator API, workcell API, notices, events, tasks.
 * The workcell HTTP contract is documented in docs/workcell-api.md; the types here mirror it.
 */

import type { AgentState } from './v1.js';

export * from './v1.js';
export * from './agent-tools.js';

export type AgentId = string;
export type TaskId = string;
export type Sha = string;
/** Monotonic version of main: v1 is the seed commit. */
export type Version = number;

export type ChangeClass = 'none' | 'additive' | 'body' | 'signature';
export type Severity = 'ignore' | 'review' | 'interrupt';
export type NoticeKind = 'write-write' | 'read-write' | 'change-order' | 'impact' | 'moved';
export type StrategyName = 'live-main' | 'pr-flow' | 'push-to-branch';

export const CLASS_RANK: Record<ChangeClass, number> = { none: 0, additive: 1, body: 2, signature: 3 };

export function maxClass(a: ChangeClass, b: ChangeClass): ChangeClass {
  return CLASS_RANK[a] >= CLASS_RANK[b] ? a : b;
}

export function severityOf(c: ChangeClass): Severity {
  return c === 'signature' ? 'interrupt' : c === 'body' ? 'review' : 'ignore';
}

// ---------------------------------------------------------------- versions

export interface VersionRecord {
  version: Version;
  sha: Sha;
  parent: Version | null;
  /** path → class of the change relative to the parent version. */
  changes: Record<string, ChangeClass>;
  promotedBy: AgentId | 'seed' | 'external';
  taskId: TaskId | null;
  changeOrder: boolean;
  at: number;
}

// ---------------------------------------------------------------- files

export interface FileChange {
  path: string;
  /** null = delete */
  content: string | null;
}

// ---------------------------------------------------------------- notices

export interface Notice {
  id: string;
  agentId: AgentId;
  kind: NoticeKind;
  severity: Severity;
  path: string;
  /** main version that caused the notice */
  version: Version;
  reason: string;
  diff?: string;
  mergeResult?: 'merged' | 'conflict' | null;
  mergeMethod?: 'mergiraf' | 'union' | 'merge-file' | null;
  at: number;
}

/** Notice as produced by the workcell checkpoint (before the coordinator stamps ids/versions). */
export interface WorkcellNotice {
  path: string;
  kind: 'write-write' | 'read-write';
  severity: Severity;
  reason: string;
  diff?: string;
  mergeResult?: 'merged' | 'conflict' | null;
  mergeMethod?: 'mergiraf' | 'union' | 'merge-file' | null;
}

// ---------------------------------------------------------------- overlays

export type OverlayStatus = 'active' | 'promoting' | 'landed' | 'abandoned';

export interface OverlayState {
  agentId: AgentId;
  taskId: TaskId;
  strategy: StrategyName;
  workcell: string;
  pin: Version;
  readSet: string[];
  writeSet: string[];
  status: OverlayStatus;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------- coordinator API

export interface RegisterRequest {
  agentId: AgentId;
  taskId: TaskId;
  strategy: StrategyName;
  workcell: string;
}
export interface RegisterResponse {
  pin: Version;
  sha: Sha;
}

export interface HeadResponse {
  version: Version;
  sha: Sha;
}

export interface CheckpointBeginResponse {
  from: Version;
  to: Version;
  toSha: Sha;
  /** paths the agent read or wrote that changed in main between from and to (max class across versions) */
  delta: Record<string, ChangeClass>;
}

export interface CheckpointCommitRequest {
  agentId: AgentId;
  to: Version;
  readSet: string[];
  writeSet: string[];
  notices: WorkcellNotice[];
}

export interface PromoteRequest {
  agentId: AgentId;
  pin: Version;
  readSet: string[];
  writeSet: string[];
  changes: FileChange[];
  /** test files the agent ran green at `pin` with this overlay */
  testsRun: string[];
  /** class of each change relative to the pin (from the workcell); unknown paths count as body */
  classes?: Record<string, ChangeClass>;
  message: string;
  priority?: boolean;
}

/** A person's change to main (a git push through Live Main), promoted by the same rule as an overlay. */
export interface ChangePromoteRequest {
  /** who pushed (display name, e.g. the Access email) */
  person: string;
  /** the main version the change was made against (the client's old main) */
  base: Version;
  changes: FileChange[];
  message: string;
  /** the pushed commit: it lands as itself when nothing on main needs merging */
  commit?: Sha;
  /** land as a change order: readers of the changed paths are interrupted */
  priority?: boolean;
}

/** A human decision an agent's landing waits for (it touches a protected path). */
export interface Approval {
  id: string;
  agentId: AgentId;
  taskId: TaskId | null;
  /** the protected paths the landing changes */
  paths: string[];
  /** withdrawn: the agent ended before anyone decided */
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  requestedAt: number;
  decidedBy: string | null;
  decidedAt: number | null;
  note: string | null;
}

export type PromoteResponse =
  | { status: 'landed'; version: Version; sha: Sha; merged: { path: string; method: string }[]; impactTests: string[] }
  | { status: 'awaiting-approval'; approvalId: string; paths: string[] }
  | { status: 'stale'; head: Version; reasons: StaleReason[] }
  | { status: 'impact-failed'; head: Version; failures: TestFileResult[] }
  | { status: 'rejected'; reason: string };

export interface StaleReason {
  path: string;
  why: 'write-write' | 'read-write';
  class: ChangeClass;
}

/** Recorded by strategies that land outside the coordinator's promotion path (baselines). */
export interface ExternalLandingRequest {
  agentId: AgentId;
  taskId: TaskId | null;
  sha: Sha;
  parentSha: Sha | null;
  changes: Record<string, ChangeClass>;
}

// ---------------------------------------------------------------- workcell API (subset used by TS)

export interface TestFileResult {
  file: string;
  ok: boolean;
  failures: { name: string; message: string }[];
}

export interface TestRunResult {
  ok: boolean;
  passed: number;
  failed: number;
  files: TestFileResult[];
  output: string;
  durationMs: number;
}

export interface CheckpointResult {
  fromSha: Sha;
  toSha: Sha;
  generation: number;
  delta: string[];
  readSet: string[];
  writeSet: string[];
  notices: WorkcellNotice[];
}

export interface OverlayInfo {
  pinSha: Sha;
  generation: number;
  readSet: string[];
  writeSet: string[];
  changes: FileChange[];
  /** sigdiff class of each change relative to the pin */
  classes?: Record<string, ChangeClass>;
}

export interface IntegrateRequest {
  remote: string;
  expectedHeadSha: Sha;
  pinSha: Sha;
  changes: FileChange[];
  autoMerge: string[];
  impactTests: string[];
  /** path → tests to run only if that path's change is body|signature */
  impactCandidates?: Record<string, string[]>;
  message: string;
  author: string;
  /** a commit to land instead of the built one when equivalent (same tree, parent = head) */
  prefer?: Sha;
}

export type IntegrateResponse =
  | {
      ok: true;
      sha: Sha;
      parent: Sha;
      changedPaths: string[];
      classes: Record<string, ChangeClass>;
      merged: { path: string; method: string }[];
      impact: TestRunResult | null;
      impactRan?: string[];
    }
  | { ok: false; error: 'head-moved'; actualHeadSha?: Sha }
  | { ok: false; error: 'needs-checkpoint'; paths: string[] }
  | { ok: false; error: 'impact-failed'; results: TestRunResult }
  | { ok: false; error: string; message?: string };

// ---------------------------------------------------------------- tasks

export type TaskKind = 'leaf' | 'helper' | 'change-order' | 'trap';

export interface Task {
  id: TaskId;
  kind: TaskKind;
  title: string;
  prompt: string;
  tests: string[];
  dependsOn: TaskId[];
  category?: string;
  expectedFiles?: string[];
  releaseAt?: number;
  contract?: boolean;
  breaks?: TaskId[];
}

export interface TaskBank {
  version: number;
  tasks: Task[];
}

export type SolutionOp =
  | { op: 'write'; path: string; content: string }
  | { op: 'insertBefore'; path: string; anchor: string; text: string }
  | { op: 'edit'; path: string; oldString: string; newString: string }
  | { op: 'codemod'; glob: string; find: string; flags?: string; replace: string }
  | { op: 'delete'; path: string };

export interface Solution {
  taskId: TaskId;
  variants: { requires: TaskId[]; ops: SolutionOp[] }[];
}

// ---------------------------------------------------------------- events (metrics + dashboard)

export type RunEvent =
  | { type: 'run.started'; runId: string; strategy: StrategyName; agents: number; tasks: number; taskIds?: TaskId[]; at: number }
  | { type: 'run.finished'; runId: string; at: number }
  | { type: 'task.started'; agentId: AgentId; taskId: TaskId; at: number }
  | { type: 'task.finished'; agentId: AgentId; taskId: TaskId; outcome: 'landed' | 'failed' | 'gave-up'; at: number }
  | {
      type: 'agent.usage';
      agentId: AgentId;
      taskId: TaskId;
      inputTokens: number;
      outputTokens: number;
      toolCalls: number;
      /** interrupt notices received, and how many needed no change (tests stayed green without edits) */
      interrupts?: number;
      falseInterrupts?: number;
      at: number;
    }
  | { type: 'checkpoint'; agentId: AgentId; from: Version; to: Version; notices: number; at: number }
  | { type: 'notice'; notice: Notice }
  | {
      type: 'landed';
      version: Version;
      sha: Sha;
      agentId: AgentId | 'seed' | 'external';
      taskId: TaskId | null;
      paths: string[];
      merged: number;
      /** auto-merged paths and how (agent landings) */
      merges?: { path: string; method: string }[];
      /** landed tests that ran before this landing (test-impact analysis) */
      impactTests?: string[];
      /** landed as a change order (readers were interrupted) */
      changeOrder?: boolean;
      /** set when a person pushed this change (agentId is then `person:<name>`) */
      pushedBy?: string;
      /** commit subject of a person's push */
      title?: string;
      /** the approval this landing needed (it changed protected paths) */
      approval?: { id: string; by: string; paths: string[] };
      at: number;
    }
  | { type: 'promotion.rejected'; agentId: AgentId; reason: 'stale' | 'impact-failed' | 'rejected' | 'needs-rebase' | 'push-rejected'; paths: string[]; at: number }
  | { type: 'rebase'; agentId: AgentId; conflicts: number; at: number }
  | { type: 'ci'; version: Version; sha: Sha; passed: number; failed: number; failing: string[]; at: number }
  | { type: 'change-order.released'; taskId: TaskId; at: number }
  /** an approval was requested or decided */
  | { type: 'approval'; approval: Approval; at: number }
  /** what an agent is doing now (drives live status in the UI) */
  | { type: 'agent.state'; agentId: AgentId; state: AgentState; detail: string; at: number }
  | { type: 'agent.step'; agentId: AgentId; tool: string; summary: string; ok: boolean; at: number }
  | { type: 'agent.tests'; agentId: AgentId; passed: number; failed: number; ok: boolean; at: number }
  /** cumulative model usage and cost so far (emitted after each model turn) */
  | { type: 'agent.cost'; agentId: AgentId; usd: number | null; inputTokens: number; outputTokens: number; at: number };

export interface Clock {
  now(): number;
}
