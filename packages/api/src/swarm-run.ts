import { AgentSession, AgentStoppedError, LiveMainStrategy, runLlmAgent, runScriptedAgent, type AgentResult, type ModelProvider, type ToolOutcome } from '@livemain/agent';
import { LocalCoordinatorClient, type Coordinator, type WorkcellClient } from '@livemain/core';
import type { ModelRule, Solution, SwarmStatus, Task, Worker } from '@livemain/protocol';
import { runSwarm } from '@livemain/swarm';
import { kindOf } from './views.js';

export interface SwarmRunDeps {
  swarmId: string;
  tasks: Task[];
  concurrency: number;
  rules: ModelRule[];
  coord: Coordinator;
  remote: string;
  workcells: { name: string; client: WorkcellClient }[];
  project: string;
  /** a provider for a model worker, with the account's key */
  provider(worker: Extract<Worker, { kind: 'model' }>): Promise<ModelProvider>;
  solution(taskId: string, naive?: boolean): Solution | undefined | Promise<Solution | undefined>;
  /** scripted workers: simulated model latency per tool call (ms) */
  thinkMs: number;
  /** record a new agent before it starts */
  register(agent: { id: string; taskId: string; worker: Worker; workcell: string }): void;
  /** an external agent's session is ready: its seat can be claimed */
  openSeat(agentId: string): void;
  /** non-null while the swarm must not launch more agents (budget or time cap) */
  capReason(): string | null;
  setStatus(status: SwarmStatus, reason: string | null): void;
  log(line: string): void;
}

/** The worker for a task: the first rule matching its kind, else the `default` rule. */
export function workerFor(task: Task, rules: ModelRule[]): Worker {
  const kind = kindOf(task);
  const rule = rules.find((r) => r.when === kind) ?? rules.find((r) => r.when === 'default') ?? rules[0];
  if (!rule) throw new Error('a swarm needs at least one model rule');
  return rule.worker;
}

/**
 * One running swarm: runSwarm over Live Main sessions, gated for pause/stop and the budget.
 * Pausing stops launching; agents already running finish. Stopping aborts them at their
 * next tool call (their overlays are kept as snapshots).
 */
/** A seat released after this long without a tool call. */
export const SEAT_IDLE_MS = 30 * 60_000;
/** External agents' submit returns within this while an approval is pending (MCP calls time out at ~60 s). */
export const EXTERNAL_APPROVAL_WAIT_MS = 20_000;

/** An external agent's session, driven by tool calls from a client (Claude Code over `lm mcp`). */
interface Seat {
  session: AgentSession;
  /** tool calls run one at a time */
  chain: Promise<unknown>;
  idle: ReturnType<typeof setTimeout> | null;
  finish(result: AgentResult): void;
}

export class SwarmRun {
  private status: SwarmStatus = 'running';
  private stopping = false;
  private readonly aborts = new Map<string, AbortController>();
  private readonly seats = new Map<string, Seat>();
  private waiters: (() => void)[] = [];
  readonly done: Promise<void>;

  constructor(private readonly d: SwarmRunDeps) {
    this.done = this.run();
  }

  pause(reason = 'paused by you'): void {
    if (this.status !== 'running') return;
    this.setStatus('paused', reason);
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.setStatus('running', null);
    this.wake();
  }

  stop(): void {
    if (this.stopping) return;
    this.stopping = true;
    this.setStatus('stopping', 'stopped by you');
    for (const a of this.aborts.values()) a.abort();
    this.wake();
  }

  stopAgent(agentId: string): boolean {
    const a = this.aborts.get(agentId);
    a?.abort();
    return a !== undefined;
  }

  claimed(agentId: string): void {
    const seat = this.seats.get(agentId);
    if (seat) this.touch(agentId, seat);
  }

  tool(agentId: string, name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
    const seat = this.seats.get(agentId);
    if (!seat) return Promise.resolve({ text: 'this agent is not active any more (it landed, gave up, or was stopped)', isError: true });
    const run = async (): Promise<ToolOutcome> => {
      this.touch(agentId, seat);
      if (name === 'give_up') {
        const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : 'gave up';
        seat.finish(result('gave-up', reason));
        return { text: 'Given up; the task goes back to the queue for someone else.', isError: false };
      }
      const out = await seat.session.call(name, input);
      if (out.landed) seat.finish(result('landed', 'landed'));
      return out;
    };
    const next = seat.chain.then(run, run);
    seat.chain = next.catch(() => undefined);
    return next;
  }

  private touch(agentId: string, seat: Seat): void {
    if (seat.idle) clearTimeout(seat.idle);
    seat.idle = setTimeout(() => seat.finish(result('gave-up', 'released: no tool call for 30 minutes')), SEAT_IDLE_MS);
    seat.idle.unref?.();
  }

  /** Wait for a client to claim and finish the agent's task; its tool calls arrive through `tool`. */
  private seat(session: AgentSession, worker: Extract<Worker, { kind: 'external' }>, signal: AbortSignal): Promise<AgentResult> {
    return new Promise<AgentResult>((resolve, reject) => {
      const agentId = session.agentId;
      const seat: Seat = {
        session,
        chain: Promise.resolve(),
        idle: null,
        finish: (r) => {
          if (seat.idle) clearTimeout(seat.idle);
          this.seats.delete(agentId);
          resolve(r);
        },
      };
      signal.addEventListener('abort', () => {
        if (seat.idle) clearTimeout(seat.idle);
        this.seats.delete(agentId);
        reject(new AgentStoppedError());
      }, { once: true });
      this.seats.set(agentId, seat);
      void session.setState('queued', `waiting for ${worker.name} to claim it`).then(() => this.d.openSeat(agentId));
    });
  }

  private setStatus(status: SwarmStatus, reason: string | null): void {
    this.status = status;
    this.d.setStatus(status, reason);
  }

  private wake(): void {
    const w = this.waiters;
    this.waiters = [];
    for (const f of w) f();
  }

  private gate = async (): Promise<'go' | 'stop'> => {
    for (;;) {
      if (this.stopping) return 'stop';
      const cap = this.d.capReason();
      if (cap && this.status === 'running') this.setStatus('paused', cap);
      if (this.status === 'running' && !cap) return 'go';
      await new Promise<void>((r) => this.waiters.push(r));
    }
  };

  private async run(): Promise<void> {
    const d = this.d;
    const coordinator = new LocalCoordinatorClient(d.coord);
    try {
      await runSwarm({
        runId: d.swarmId,
        strategy: 'live-main',
        tasks: d.tasks,
        concurrency: d.concurrency,
        emit: (e) => void d.coord.emit(e),
        log: d.log,
        gate: this.gate,
        runTask: async ({ task, slot, agentId }) => {
          const wc = d.workcells[slot % d.workcells.length]!;
          const worker = workerFor(task, d.rules);
          d.register({ id: agentId, taskId: task.id, worker, workcell: wc.name });
          const abort = new AbortController();
          this.aborts.set(agentId, abort);
          const session = new AgentSession({
            agentId,
            task,
            strategy: new LiveMainStrategy(worker.kind === 'external' ? { approvalWaitMs: EXTERNAL_APPROVAL_WAIT_MS } : {}),
            workcell: wc.client,
            workcellName: wc.name,
            coordinator,
            remote: d.remote,
            snapshot: { remote: d.remote },
            signal: abort.signal,
          });
          let result: AgentResult | null = null;
          let final: { state: 'gave-up' | 'stopped' | 'error'; detail: string } | null = null;
          try {
            await session.start();
            result = await this.work(session, task, worker);
            if (!session.landed) final = { state: 'gave-up', detail: result.reason };
          } catch (err) {
            final = err instanceof AgentStoppedError || abort.signal.aborted ? { state: 'stopped', detail: this.stopping ? 'swarm stopped' : 'stopped by you' } : { state: 'error', detail: err instanceof Error ? err.message : String(err) };
            d.log(`${agentId}: ${final.detail}`);
          } finally {
            this.aborts.delete(agentId);
          }
          if (final) {
            await session.setState(final.state, final.detail);
            try {
              d.coord.finish(agentId, final.state === 'gave-up' ? 'gave-up' : 'failed');
            } catch {
              // never registered (failed before setup)
            }
          }
          await session.close();
          return session.landed ? 'landed' : final?.state === 'gave-up' ? 'gave-up' : 'failed';
        },
      });
    } finally {
      this.setStatus(this.stopping ? 'stopped' : 'finished', this.stopping ? 'stopped by you' : null);
      this.wake();
    }
  }

  private async work(session: AgentSession, task: Task, worker: Worker): Promise<AgentResult> {
    const d = this.d;
    if (worker.kind === 'model') return runLlmAgent(session, { provider: await d.provider(worker), model: worker.model, project: d.project });
    if (worker.kind === 'scripted') {
      const solution = await d.solution(task.id);
      if (!solution) throw new Error(`no reference solution for ${task.id}`);
      const jitter = () => (d.thinkMs > 0 ? Math.round(d.thinkMs * (0.5 + Math.random())) : 0);
      return runScriptedAgent(session, { solution, naive: await d.solution(task.id, true), thinkMs: jitter });
    }
    return this.seat(session, worker, session.signal!);
  }
}

function result(outcome: AgentResult['outcome'], reason: string): AgentResult {
  return { outcome, turns: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reason };
}
