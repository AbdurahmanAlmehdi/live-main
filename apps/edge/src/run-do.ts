import { DurableObject } from 'cloudflare:workers';
import type { StrategyName, TaskBank, TaskId } from '@livemain/protocol';
import { Scheduler, selectTasks, type TaskStatus } from '@livemain/swarm';
import type { AgentJob } from './agent-do.js';
import { coordinatorClient, integratorName, workcellClient } from './clients.js';
import { authedRepoRemote, type Env } from './env.js';

export interface RunConfig {
  runId: string;
  strategy: StrategyName;
  agents: number;
  workcells: number;
  tasks: number;
  mode: 'scripted' | 'llm';
  thinkMs: number;
  model?: string;
  /** model for change-order (contract) tasks */
  coModel?: string;
  /** directory inside the workcell image to seed main from */
  seedDir?: string;
}

interface RunState {
  config: RunConfig;
  remote: string;
  taskIds: TaskId[];
  scheduler: { status: [TaskId, TaskStatus][]; released: TaskId[] };
  /** slot → agentId currently working */
  slots: (string | null)[];
  attempt: number;
  lastCiVersion: number;
  finished: boolean;
}

const TICK_MS = 2000;

/**
 * Drives one benchmark run on Cloudflare: provisions the main repo (Artifacts), seeds it,
 * configures the run's coordinator, dispatches tasks to SwarmAgent DOs with the shared
 * Scheduler, runs post-land CI on new heads, and emits run events.
 */
export class RunDO extends DurableObject<Env> {
  /**
   * Serializes every read-modify-write of the run state. Awaiting I/O (asset fetches,
   * RPC) opens the input gate, so without this, concurrent reports and alarms lose updates.
   */
  private chain: Promise<unknown> = Promise.resolve();

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** RPC (index instance only): remember a run id. */
  async register(runId: string): Promise<void> {
    const ids = (await this.ctx.storage.get<string[]>('runs')) ?? [];
    if (!ids.includes(runId)) ids.push(runId);
    await this.ctx.storage.put('runs', ids);
  }

  async list(): Promise<string[]> {
    return (await this.ctx.storage.get<string[]>('runs')) ?? [];
  }

  /** RPC: start a run. Returns once main is seeded and agents are being dispatched. */
  async start(config: RunConfig): Promise<{ runId: string; remote: string; seedSha: string }> {
    if (await this.ctx.storage.get('state')) throw new Error(`run ${config.runId} already started`);
    const bank = await this.bank();
    const tasks = selectTasks(bank.tasks, config.tasks);
    const remote = await this.createRepo(`lm-${config.runId}`);
    const integrator = workcellClient(this.env, integratorName(config.runId), 'integrator');
    const { sha } = await integrator.seed(remote, config.seedDir ?? '/seed/demo-repo', 'seed: formula engine skeleton');
    const coordStub = this.env.COORDINATOR.get(this.env.COORDINATOR.idFromName(config.runId));
    await coordStub.configure({ runId: config.runId, remote });
    const coordinator = coordinatorClient(this.env, config.runId);
    await coordinator.init(sha);
    await coordinator.emit({ type: 'run.started', runId: config.runId, strategy: config.strategy, agents: config.agents, tasks: tasks.length, taskIds: tasks.map((t) => t.id), at: Date.now() });

    const scheduler = new Scheduler(tasks);
    const state: RunState = {
      config,
      remote,
      taskIds: tasks.map((t) => t.id),
      scheduler: scheduler.snapshot(),
      slots: Array.from({ length: config.agents }, () => null),
      attempt: 0,
      lastCiVersion: 0,
      finished: false,
    };
    await this.ctx.storage.put('state', state);
    await this.ctx.storage.setAlarm(Date.now());
    return { runId: config.runId, remote, seedSha: sha };
  }

  /** RPC from an agent: its task finished. */
  async report(agentId: string, slot: number, taskId: TaskId, outcome: 'landed' | 'failed' | 'gave-up' | 'paused'): Promise<void> {
    return this.exclusive(() => this.applyReport(agentId, slot, taskId, outcome));
  }

  private async applyReport(agentId: string, slot: number, taskId: TaskId, outcome: 'landed' | 'failed' | 'gave-up' | 'paused'): Promise<void> {
    const state = await this.ctx.storage.get<RunState>('state');
    if (!state) return;
    const scheduler = await this.scheduler(state);
    scheduler.finish(taskId, outcome === 'landed' ? 'landed' : 'failed');
    if (state.slots[slot] === agentId) state.slots[slot] = null;
    state.scheduler = scheduler.snapshot();
    await this.ctx.storage.put('state', state);
    await this.ctx.storage.setAlarm(Date.now());
  }

  async status(): Promise<{ config: RunConfig; counts: Record<TaskStatus, number>; finished: boolean } | null> {
    const state = await this.ctx.storage.get<RunState>('state');
    if (!state) return null;
    return { config: state.config, counts: (await this.scheduler(state)).counts(), finished: state.finished };
  }

  override async alarm(): Promise<void> {
    return this.exclusive(() => this.tick());
  }

  private async tick(): Promise<void> {
    const state = await this.ctx.storage.get<RunState>('state');
    if (!state || state.finished) return;
    const scheduler = await this.scheduler(state);
    const coordinator = coordinatorClient(this.env, state.config.runId);

    for (const co of scheduler.takeReleased()) await coordinator.emit({ type: 'change-order.released', taskId: co.id, at: Date.now() });
    const dispatch = async () => {
      for (let slot = 0; slot < state.slots.length; slot++) {
        if (state.slots[slot]) continue;
        const task = scheduler.next();
        if (!task) break;
        const agentId = `${state.config.runId}-a${slot}-${task.id}-${state.attempt++}`;
        state.slots[slot] = agentId;
        const job: AgentJob = {
          runId: state.config.runId,
          agentId,
          slot,
          workcells: state.config.workcells,
          task,
          strategy: state.config.strategy,
          remote: state.remote,
          mode: state.config.mode,
          thinkMs: state.config.thinkMs,
          model: task.kind === 'change-order' && state.config.coModel ? state.config.coModel : state.config.model,
        };
        await this.env.AGENT.get(this.env.AGENT.idFromName(agentId)).begin(job);
      }
    };
    await dispatch();
    if (state.slots.every((s) => s === null)) {
      scheduler.releaseAll();
      for (const co of scheduler.takeReleased()) await coordinator.emit({ type: 'change-order.released', taskId: co.id, at: Date.now() });
      await dispatch();
    }

    await this.ci(state);
    const idle = state.slots.every((s) => s === null);
    if (idle) {
      state.finished = true;
      await coordinator.emit({ type: 'run.finished', runId: state.config.runId, at: Date.now() });
    }
    state.scheduler = scheduler.snapshot();
    await this.ctx.storage.put('state', state);
    if (!idle) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  /** Post-land CI on the newest head (coalesces intermediate versions). */
  private async ci(state: RunState): Promise<void> {
    const coordinator = coordinatorClient(this.env, state.config.runId);
    const head = await coordinator.head();
    if (head.version === state.lastCiVersion) return;
    const integrator = workcellClient(this.env, integratorName(state.config.runId), 'integrator');
    try {
      const sched = await this.scheduler(state);
      const files = ['tests/core/', ...new Set(state.taskIds.flatMap((id) => sched.get(id).tests).filter((f) => !f.startsWith('tests/core/')))];
      const result = await integrator.ci(state.remote, head.sha, files);
      await coordinator.recordCi(head.version, head.sha, result);
      state.lastCiVersion = head.version;
    } catch {
      // retried on the next tick
    }
  }

  private async scheduler(state: RunState): Promise<Scheduler> {
    const bank = await this.bank();
    const wanted = new Set(state.taskIds);
    const s = new Scheduler(bank.tasks.filter((t) => wanted.has(t.id)));
    s.restore(state.scheduler);
    return s;
  }

  private bankCache: TaskBank | null = null;

  private async bank(): Promise<TaskBank> {
    if (this.bankCache) return this.bankCache;
    const res = await this.env.ASSETS.fetch('http://assets/bench/tasks.json');
    if (!res.ok) throw new Error('task bank missing from assets (run scripts/build-edge-assets)');
    this.bankCache = (await res.json()) as TaskBank;
    return this.bankCache;
  }

  /** Main repo for the run: Cloudflare Artifacts when bound, else a git server (local dev). */
  private async createRepo(name: string): Promise<string> {
    if (this.env.ARTIFACTS) {
      return authedRepoRemote(await this.env.ARTIFACTS.create(name, { description: 'Live Main run' }));
    }
    if (!this.env.GIT_REMOTE_BASE) throw new Error('no ARTIFACTS binding and no GIT_REMOTE_BASE configured');
    const res = await fetch(`${this.env.GIT_REMOTE_BASE}/repos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`git server: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { remote: string }).remote;
  }
}
