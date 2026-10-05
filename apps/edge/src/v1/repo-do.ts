import { DurableObject } from 'cloudflare:workers';
import { createProvider } from '@livemain/agent';
import { ApiError, handleRepo, json, REPO_PATH, RepoService, workerFor, type ModelKeys, type RepoRecord, type SwarmHandle, type SwarmRunDeps, type SwarmRunner } from '@livemain/api';
import { handleCoordinatorRequest } from '@livemain/core';
import { FINAL_AGENT_STATES, PROVIDERS, type AgentState, type ProviderId, type Repo, type Task } from '@livemain/protocol';
import { Scheduler, type TaskStatus } from '@livemain/swarm';
import { doSqlStore } from '../do-sql.js';
import type { Env } from '../env.js';
import type { RepoAgentJob } from './repo-agent-do.js';
import { gitHost, integrator, org, session, templates, vault, workcells } from './platform.js';

interface RunState {
  scheduler: { status: [string, TaskStatus][]; released: string[] };
  /** slot → agent currently working */
  slots: (string | null)[];
  attempt: number;
  paused: boolean;
  stopping: boolean;
  finished: boolean;
}

/** Heartbeat while swarms run: catches lost reports and keeps CI moving. */
const HEARTBEAT_MS = 20_000;

/**
 * Swarms on Durable Objects: the scheduler's state lives in the repo's SQL, an alarm launches
 * agents into RepoAgentDOs (which run in alarm slices), and agents report back by RPC. A swarm
 * therefore survives the repo object being evicted, unlike an in-process loop.
 */
class DoSwarmRunner implements SwarmRunner {
  readonly durable = true;
  private readonly done = new Map<string, () => void>();
  /**
   * Run-state updates happen one at a time: `advance` awaits RPCs between loading and saving,
   * and a report landing in that gap would otherwise be overwritten (its slot never freed).
   */
  private lock: Promise<unknown> = Promise.resolve();

  private serial<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = this.lock.then(fn, fn);
    this.lock = next.catch(() => undefined);
    return next;
  }

  constructor(private readonly host: RepoDO) {
    host.sqlExec(`CREATE TABLE IF NOT EXISTS edge_swarm_runs (id TEXT PRIMARY KEY, state TEXT NOT NULL)`);
  }

  private load(id: string): RunState | null {
    const row = this.host.sqlExec<{ state: string }>(`SELECT state FROM edge_swarm_runs WHERE id = ?`, id)[0];
    return row ? (JSON.parse(row.state) as RunState) : null;
  }

  private save(id: string, state: RunState): void {
    this.host.sqlExec(`INSERT OR REPLACE INTO edge_swarm_runs (id, state) VALUES (?, ?)`, id, JSON.stringify(state));
  }

  start(deps: SwarmRunDeps): SwarmHandle {
    this.save(deps.swarmId, {
      scheduler: new Scheduler(deps.tasks).snapshot(),
      slots: Array.from({ length: deps.concurrency }, () => null),
      attempt: 0,
      paused: false,
      stopping: false,
      finished: false,
    });
    this.host.wake();
    return this.handle(deps.swarmId, new Promise<void>((r) => this.done.set(deps.swarmId, r)));
  }

  attach(swarmId: string): SwarmHandle | null {
    const state = this.load(swarmId);
    return state && !state.finished ? this.handle(swarmId, new Promise<void>(() => undefined)) : null;
  }

  private handle(id: string, done: Promise<void>): SwarmHandle {
    const update = (fn: (s: RunState, deps: SwarmRunDeps) => void) =>
      void this.serial(() => {
        const state = this.load(id);
        if (!state || state.finished) return;
        fn(state, this.host.swarmDeps(id));
        this.save(id, state);
        this.host.wake();
      });
    return {
      done,
      pause: (reason = 'paused by you') =>
        update((s, d) => {
          s.paused = true;
          d.setStatus('paused', reason);
        }),
      resume: () =>
        update((s, d) => {
          s.paused = false;
          d.setStatus('running', null);
        }),
      stop: () =>
        update((s, d) => {
          s.stopping = true;
          s.paused = false;
          d.setStatus('stopping', 'stopped by you');
          for (const a of s.slots) if (a) void this.host.agent(a).stop();
        }),
      stopAgent: (agentId) => {
        const state = this.load(id);
        if (!state?.slots.includes(agentId)) return false;
        void this.host.agent(agentId).stop();
        return true;
      },
      claimed: (agentId) => this.host.agent(agentId).claimed(),
      tool: async (agentId, name, input) => {
        if (!this.load(id)?.slots.includes(agentId)) return { text: 'this agent is not active any more (it landed, gave up, or was stopped)', isError: true };
        return this.host.agent(agentId).tool(name, input);
      },
    };
  }

  /** RPC path: an agent finished its task. */
  report(swarmId: string, agentId: string, slot: number, taskId: string, landed: boolean): Promise<void> {
    return this.serial(() => {
      const state = this.load(swarmId);
      if (!state || state.slots[slot] !== agentId) return;
      const scheduler = this.scheduler(this.host.swarmDeps(swarmId), state);
      scheduler.finish(taskId, landed ? 'landed' : 'failed');
      state.slots[slot] = null;
      state.scheduler = scheduler.snapshot();
      this.save(swarmId, state);
    });
  }

  private scheduler(deps: SwarmRunDeps, state: RunState): Scheduler {
    const s = new Scheduler(deps.tasks);
    s.restore(state.scheduler);
    return s;
  }

  /** Advance every unfinished swarm; true while any is still running. */
  tick(): Promise<boolean> {
    return this.serial(() => this.tickAll());
  }

  private async tickAll(): Promise<boolean> {
    let active = false;
    for (const { id } of this.host.sqlExec<{ id: string }>(`SELECT id FROM edge_swarm_runs`)) {
      const state = this.load(id);
      if (!state || state.finished) continue;
      try {
        if (await this.advance(id, state)) active = true;
      } catch (err) {
        // One broken swarm must not stall the others; it is retried on the next heartbeat.
        console.error(`swarm ${id}: ${err instanceof Error ? err.stack : String(err)}`);
        active = true;
      }
    }
    return active;
  }

  /** One swarm's tick; true while it is still running. */
  private async advance(id: string, state: RunState): Promise<boolean> {
    const deps = this.host.swarmDeps(id);
    const scheduler = this.scheduler(deps, state);
    for (const co of scheduler.takeReleased()) deps.coord.emit({ type: 'change-order.released', taskId: co.id, at: Date.now() });

    this.freeFinished(state, scheduler);
    const cap = !state.stopping && !state.paused ? deps.capReason() : null;
    if (cap) {
      state.paused = true;
      deps.setStatus('paused', cap);
    }
    const launch = async () => {
      if (state.stopping || state.paused) return;
      for (let slot = 0; slot < state.slots.length; slot++) {
        if (state.slots[slot]) continue;
        const task = scheduler.next();
        if (!task) break;
        await this.launch(id, deps, state, scheduler, task, slot);
      }
    };
    await launch();
    if (state.slots.every((s) => s === null) && !state.paused) {
      // Nothing running: release held change orders, then finish if nothing is left.
      scheduler.releaseAll();
      await launch();
      if (state.slots.every((s) => s === null)) {
        state.finished = true;
        deps.setStatus(state.stopping ? 'stopped' : 'finished', state.stopping ? 'stopped by you' : null);
        this.done.get(id)?.();
        this.done.delete(id);
      }
    }
    state.scheduler = scheduler.snapshot();
    this.save(id, state);
    return !state.finished;
  }

  /** Frees slots whose agent already ended, in case its report was lost. */
  private freeFinished(state: RunState, scheduler: Scheduler): void {
    state.slots.forEach((agentId, slot) => {
      if (!agentId) return;
      const row = this.host.sqlExec<{ state: string; task_id: string }>(`SELECT state, task_id FROM agents WHERE id = ?`, agentId)[0];
      if (!row || !FINAL_AGENT_STATES.has(row.state as AgentState)) return;
      scheduler.finish(row.task_id, row.state === 'landed' ? 'landed' : 'failed');
      state.slots[slot] = null;
    });
  }

  private async launch(swarmId: string, deps: SwarmRunDeps, state: RunState, scheduler: Scheduler, task: Task, slot: number): Promise<void> {
    const agentId = `${swarmId}-a${slot}-${task.id}-${state.attempt++}`;
    const wc = deps.workcells[slot % deps.workcells.length]!;
    const worker = workerFor(task, deps.rules);
    deps.register({ id: agentId, taskId: task.id, worker, workcell: wc.name });
    state.slots[slot] = agentId;
    const job: RepoAgentJob = { repoId: this.host.repoId(), swarmId, agentId, slot, task, worker, workcell: wc.name, remote: deps.remote, thinkMs: deps.thinkMs, project: deps.project };
    try {
      await this.host.agent(agentId).begin(job);
    } catch (err) {
      deps.log(`${agentId} could not start: ${String(err)}`);
      state.slots[slot] = null;
      scheduler.finish(task.id, 'failed');
    }
  }
}

/** One repository: RepoService on this object's SQLite, its live events, and its swarms. */
export class RepoDO extends DurableObject<Env> {
  private svc: RepoService | null = null;
  private readonly runner: DoSwarmRunner;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.runner = new DoSwarmRunner(this);
  }

  sqlExec<T extends Record<string, string | number | null>>(query: string, ...params: (string | number | null)[]): T[] {
    return this.ctx.storage.sql.exec(query, ...params).toArray() as T[];
  }

  repoId(): string {
    if (!this.svc) throw new Error('repository not initialized');
    return this.svc.record.id;
  }

  agent(agentId: string) {
    return this.env.REPO_AGENT.get(this.env.REPO_AGENT.idFromName(agentId));
  }

  swarmDeps(id: string): SwarmRunDeps {
    if (!this.svc) throw new Error('repository not initialized');
    return this.svc.swarmDeps(id);
  }

  wake(): void {
    void this.ctx.storage.setAlarm(Date.now());
  }

  private keys(): ModelKeys {
    const orgStub = () => this.env.ORG.get(this.env.ORG.idFromName(org(this.env)));
    return {
      missing: (wanted: ProviderId[]) => orgStub().missingKeys(wanted),
      provider: async (id: ProviderId) => {
        const k = await orgStub().sealedKey(id);
        if (!k) throw new ApiError(400, 'missing-key', `no ${PROVIDERS[id].label} key`);
        return createProvider({ provider: id, apiKey: await vault(this.env).open(k.sealed), baseUrl: k.baseUrl });
      },
    };
  }

  private async service(): Promise<RepoService | null> {
    if (this.svc) return this.svc;
    const record = await this.ctx.storage.get<RepoRecord>('record');
    if (!record) return null;
    const template = record.template ? (await templates(this.env)).find((t) => t.id === record.template) : undefined;
    if (this.svc) return this.svc; // another request built it while we awaited
    this.svc = new RepoService({
      user: session(this.env).user.login,
      record,
      sql: doSqlStore(this.ctx.storage),
      git: gitHost(this.env),
      integrator: integrator(this.env),
      workcells: workcells(this.env),
      template,
      keys: this.keys(),
      runner: this.runner,
      log: (line) => console.log(line),
    });
    // Live events go to every connected (possibly hibernated) WebSocket.
    this.svc.subscribe((e) => {
      const msg = JSON.stringify(e);
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(msg);
        } catch {
          // closing socket
        }
      }
    });
    return this.svc;
  }

  /** RPC from the org: a new repository's first commit becomes main v1. */
  async init(record: RepoRecord, seed: { sha: string; title: string; tasks: Task[] }): Promise<void> {
    await this.ctx.storage.put('record', record);
    (await this.service())!.init(seed);
    await this.ctx.storage.setAlarm(Date.now() + HEARTBEAT_MS);
  }

  /** RPC from the org: the repository summary. */
  async view(): Promise<Repo> {
    const svc = await this.service();
    if (!svc) throw new Error('repository not initialized');
    return svc.view();
  }

  /** RPC from an external agent: its session is ready to be claimed. */
  async openSeat(agentId: string): Promise<void> {
    (await this.service())?.openSeat(agentId);
  }

  /** RPC from an agent: its task finished. */
  async report(swarmId: string, agentId: string, slot: number, taskId: string, landed: boolean): Promise<void> {
    await this.service();
    await this.runner.report(swarmId, agentId, slot, taskId, landed);
    this.wake();
  }

  override async fetch(request: Request): Promise<Response> {
    const svc = await this.service();
    const url = new URL(request.url);
    if (!svc) return json({ error: 'not-found', message: 'repository not found' }, 404);
    if (url.pathname.startsWith('/coordinator/api/')) {
      // Agents in other Durable Objects reach this repo's coordinator here (not routed publicly).
      const inner = new URL(request.url);
      inner.pathname = url.pathname.slice('/coordinator'.length);
      return handleCoordinatorRequest(svc.coordinator, new Request(inner, request));
    }
    const m = REPO_PATH.exec(url.pathname);
    if (!m) return json({ error: 'not-found', message: `no route ${url.pathname}` }, 404);
    if (m[3] === '/events') {
      if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'upgrade-required', message: 'connect with a WebSocket' }, 426);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return handleRepo(svc, request, m[3] ?? '');
  }

  override async alarm(): Promise<void> {
    const svc = await this.service();
    if (!svc) return;
    const active = await this.runner.tick();
    await svc.ciOnce();
    if (active) await this.ctx.storage.setAlarm(Date.now() + HEARTBEAT_MS);
  }

  override async webSocketMessage(): Promise<void> {
    // Clients only listen.
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }
}
