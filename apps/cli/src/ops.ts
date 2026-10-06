import { execFileSync } from 'node:child_process';
import { PROVIDERS, type AgentSummary, type AgentToolResult, type ApprovalView, type ClaimedTask, type Landing, type ProviderId, type Repo, type Swarm, type TaskV1, type Worker } from '@livemain/protocol';
import { CliError, type Client } from './client.js';

/**
 * What the CLI and the MCP server both do, over the API. Commands print these; MCP tools
 * return them as text.
 */

/** `claude-code` (seats for Claude Code), `scripted` (replay), or `<provider>:<model>`. */
export function workerFrom(spec: string): Worker {
  if (spec === 'claude-code' || spec === 'external') return { kind: 'external', name: 'Claude Code' };
  if (spec === 'scripted') return { kind: 'scripted' };
  const [provider, ...model] = spec.split(':');
  if (!provider || !(provider in PROVIDERS) || model.length === 0) throw new CliError(`Unknown worker "${spec}": use claude-code, scripted, or <provider>:<model> (e.g. anthropic:claude-haiku-4-5).`);
  return { kind: 'model', provider: provider as ProviderId, model: model.join(':') };
}

/** owner/name from an argument, or from the current clone's Live Main remote. */
export function resolveRepo(arg: string | undefined): string {
  if (arg && /^[^/\s]+\/[^/\s]+$/.test(arg)) return arg;
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = /\/git\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {
    // not in a clone
  }
  throw new CliError('Which repository? Pass owner/repo (or run inside a clone of one).');
}

export interface DispatchOptions {
  taskIds?: string[];
  /** dispatch the first N open tasks */
  first?: number;
  newTasks?: { title: string; prompt?: string }[];
  concurrency: number;
  worker: string;
  name?: string;
}

export async function dispatch(c: Client, repo: string, o: DispatchOptions): Promise<Swarm> {
  let taskIds = o.taskIds;
  if (!taskIds?.length && o.first) {
    const open = await c.call<TaskV1[]>('GET', `${c.repo(repo)}/tasks?status=open`);
    taskIds = open.filter((t) => t.dependsOn.length === 0).slice(0, o.first).map((t) => t.id);
  }
  return c.call<Swarm>('POST', `${c.repo(repo)}/swarms`, {
    name: o.name,
    taskIds,
    newTasks: o.newTasks,
    concurrency: o.concurrency,
    rules: [{ when: 'default', worker: workerFrom(o.worker) }],
  });
}

/** The prompt an operator gives each Claude Code subagent that works one seat. */
export function subagentPrompt(repo: string, swarm: Swarm): string {
  return [
    `You are an agent in a Live Main swarm on ${repo}. Work only through the livemain MCP tools (never local files or shell).`,
    `1. Call claim_task with repo "${repo}" and swarm_id "${swarm.id}". It returns your agent handle, the task and the working rules; read them.`,
    '2. Do the task with the agent tools (read_file, list_dir, grep, edit_file, write_file, ...), always passing your agent handle.',
    '3. Run run_tests until your task tests pass, then call submit. If it does not land, follow its instructions (it may report that main moved, a test on main broke, or that a person must approve) and submit again.',
    '4. When it lands, call claim_task again for the next task. Stop when claim_task says the swarm has nothing left.',
    'If you cannot finish a task, call give_up with the reason.',
  ].join('\n');
}

export function agentHandle(repo: string, agentId: string): string {
  return `${repo}/${agentId}`;
}

export function parseHandle(handle: string): { repo: string; agentId: string } {
  const [owner, name, ...rest] = handle.split('/');
  if (!owner || !name || rest.length !== 1) throw new CliError(`"${handle}" is not an agent handle (owner/repo/agent-id, from claim_task).`);
  return { repo: `${owner}/${name}`, agentId: rest[0]! };
}

/**
 * Claim a seat, waiting up to `waitSeconds` for one to open: the task, 'done' once the swarm has
 * nothing queued or running, or 'busy' when other agents still hold every remaining task.
 */
export async function claimTask(c: Client, repo: string, swarmId: string | undefined, waitSeconds = 60): Promise<ClaimedTask | 'done' | 'busy'> {
  const until = Date.now() + waitSeconds * 1000;
  for (;;) {
    try {
      return await c.call<ClaimedTask>('POST', `${c.repo(repo)}/claims`, { swarmId });
    } catch (err) {
      if (!(err instanceof CliError) || err.code !== 'no-open-task') throw err;
      if (swarmId) {
        const s = await c.call<Swarm>('GET', `${c.repo(repo)}/swarms/${encodeURIComponent(swarmId)}`);
        if (s.status === 'finished' || s.status === 'stopped' || s.counts.queued + s.counts.running === 0) return 'done';
      }
      if (Date.now() > until) {
        if (swarmId) return 'busy';
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export function agentTool(c: Client, handle: string, name: string, input: Record<string, unknown>): Promise<AgentToolResult> {
  const { repo, agentId } = parseHandle(handle);
  return c.call<AgentToolResult>('POST', `${c.repo(repo)}/agents/${encodeURIComponent(agentId)}/tools/${encodeURIComponent(name)}`, { input });
}

// ------------------------------------------------------------------ text

export const repoLine = (r: Repo) => `${r.fullName.padEnd(32)} ${r.main ? `main v${r.main.version}` : 'empty'.padEnd(9)}  ${r.activity.activeAgents} agents  ${r.description}`;
export const taskLine = (t: TaskV1) => `${t.id.padEnd(28)} ${t.status.padEnd(9)} ${t.title}`;
export const swarmLine = (s: Swarm) => `${s.id}  ${s.status.padEnd(9)} ${s.counts.landed}/${s.counts.total} landed, ${s.counts.running} running, ${s.counts.queued} queued  ${s.name}${s.dispatchedBy ? `  (by ${s.dispatchedBy})` : ''}`;
export const agentLine = (a: AgentSummary) => `${a.id.padEnd(34)} ${a.state.padEnd(13)} ${a.taskTitle}${a.detail ? ` · ${a.detail}` : ''}`;
export const approvalLine = (a: ApprovalView) => `${a.id}  ${a.status.padEnd(8)} ${a.taskTitle}: ${a.paths.join(', ')}${a.decidedBy ? `  (${a.decidedBy}${a.note ? `: ${a.note}` : ''})` : ''}`;
export function landingLine(l: Landing): string {
  const by = l.by.kind === 'agent' ? `agent ${l.by.agentId}${l.by.delegatedBy ? ` for ${l.by.delegatedBy}` : ''}` : l.by.kind === 'human' ? `${l.by.name} (push)` : 'seed';
  return `v${String(l.version).padEnd(4)} ${l.sha.slice(0, 8)}  ${l.title}  · ${by}${l.ci ? `  · CI ${l.ci.passed}/${l.ci.passed + l.ci.failed}` : ''}${l.approval ? `  · approved by ${l.approval.by}` : ''}`;
}
