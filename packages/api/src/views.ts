import type { SqlValue } from '@livemain/core';
import type { AgentState, AgentSummary, Budget, FileStat, Landing, ModelRule, RepoSource, Swarm, SwarmCounts, SwarmStatus, Task, TaskKindV1, TaskStatus, TaskV1, Worker } from '@livemain/protocol';
import type { RepoRecord } from './ports.js';

export interface RepoRow extends Record<string, SqlValue> {
  id: string;
  owner: string;
  name: string;
  description: string;
  source: string;
  template: string | null;
  remote: string;
  clone_url: string;
  created_at: number;
}

export interface TaskRow extends Record<string, SqlValue> {
  id: string;
  spec: string;
  kind: string;
  labels: string;
  status: string;
  swarm_id: string | null;
  source: string;
  created_at: number;
}

export interface SwarmRow extends Record<string, SqlValue> {
  id: string;
  name: string;
  status: string;
  concurrency: number;
  rules: string;
  budget: string;
  task_ids: string;
  created_at: number;
  finished_at: number | null;
  reason: string | null;
  final_counts: string | null;
  dispatched_by: string | null;
}

export interface AgentRow extends Record<string, SqlValue> {
  id: string;
  swarm_id: string;
  task_id: string;
  worker: string;
  workcell: string;
  state: string;
  detail: string;
  pin: number | null;
  tool_calls: number;
  cost_usd: number | null;
  input_tokens: number;
  output_tokens: number;
  interrupts: number;
  reviews: number;
  guards: number;
  started_at: number;
  updated_at: number;
  finished_at: number | null;
  landed_version: number | null;
  /** external agents: 'open' (waiting for a client) or 'claimed' */
  seat: string | null;
  claimed_by: string | null;
}

export interface LandingRow extends Record<string, SqlValue> {
  version: number;
  sha: string;
  at: number;
  title: string;
  by: string;
  change_order: number;
  files: string;
  merged: number;
  impact: string;
  ci: string | null;
  approval: string | null;
}

export function repoRecord(r: RepoRow): RepoRecord {
  return {
    id: r.id,
    owner: r.owner,
    name: r.name,
    description: r.description,
    source: JSON.parse(r.source) as RepoSource,
    template: r.template,
    remote: r.remote,
    cloneUrl: r.clone_url,
    createdAt: r.created_at,
  };
}

/** The bank's kinds map onto the public three: helpers and traps are features too. */
export function kindOf(t: Task): TaskKindV1 {
  if (t.kind === 'change-order') return 'change-order';
  return t.contract || t.kind === 'helper' ? 'contract' : 'feature';
}

export function taskView(r: TaskRow, repoId: string): TaskV1 {
  const spec = JSON.parse(r.spec) as Task;
  return {
    id: r.id,
    repoId,
    title: spec.title,
    prompt: spec.prompt,
    kind: r.kind as TaskKindV1,
    tests: spec.tests,
    dependsOn: spec.dependsOn,
    labels: JSON.parse(r.labels) as string[],
    status: r.status as TaskStatus,
    swarmId: r.swarm_id,
    createdAt: r.created_at,
    source: r.source as TaskV1['source'],
  };
}

export function agentView(r: AgentRow, repoId: string, taskTitle: string, writes: FileStat[] = [], reads = 0): AgentSummary {
  return {
    id: r.id,
    repoId,
    swarmId: r.swarm_id,
    taskId: r.task_id,
    taskTitle,
    worker: JSON.parse(r.worker) as Worker,
    state: r.state as AgentState,
    detail: r.detail,
    pin: r.pin,
    writes,
    reads,
    notices: { interrupt: r.interrupts, review: r.reviews },
    guards: r.guards,
    toolCalls: r.tool_calls,
    cost: { usd: r.cost_usd ?? 0, inputTokens: r.input_tokens, outputTokens: r.output_tokens },
    startedAt: r.started_at,
    updatedAt: r.updated_at,
    finishedAt: r.finished_at,
    landedVersion: r.landed_version,
  };
}

export function swarmView(r: SwarmRow, repoId: string, counts: SwarmCounts, cost: { usd: number; inputTokens: number; outputTokens: number; known: boolean }): Swarm {
  const done = counts.landed + counts.failed + counts.gaveUp;
  return {
    id: r.id,
    repoId,
    name: r.name,
    status: r.status as SwarmStatus,
    concurrency: r.concurrency,
    rules: JSON.parse(r.rules) as ModelRule[],
    budget: JSON.parse(r.budget) as Budget,
    taskIds: JSON.parse(r.task_ids) as string[],
    counts,
    cost: { usd: cost.usd, inputTokens: cost.inputTokens, outputTokens: cost.outputTokens },
    estimateUsd: cost.known && done > 0 ? (cost.usd / Math.max(1, done + counts.running * 0.5)) * counts.total : null,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    reason: r.reason,
    dispatchedBy: r.dispatched_by ?? null,
  };
}

export function landingView(r: LandingRow, worker: Worker | null, swarmId: string | null, delegatedBy: string | null): Landing {
  const by = JSON.parse(r.by) as { kind: string; agentId?: string; taskId?: string | null; name?: string; via?: 'github' | 'push' };
  return {
    version: r.version,
    sha: r.sha,
    at: r.at,
    title: r.title,
    by:
      by.kind === 'agent'
        ? { kind: 'agent', agentId: by.agentId!, taskId: by.taskId ?? null, swarmId, worker, delegatedBy }
        : by.kind === 'human'
          ? { kind: 'human', name: by.name ?? 'someone', via: by.via ?? 'push' }
          : { kind: 'seed' },
    changeOrder: r.change_order === 1,
    files: JSON.parse(r.files) as FileStat[],
    merged: r.merged,
    impactTests: JSON.parse(r.impact) as string[],
    ci: r.ci ? (JSON.parse(r.ci) as { passed: number; failed: number }) : null,
    approval: r.approval ? (JSON.parse(r.approval) as { by: string; paths: string[] }) : null,
  };
}
