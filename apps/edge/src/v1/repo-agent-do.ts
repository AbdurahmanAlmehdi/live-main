import { DurableObject } from 'cloudflare:workers';
import {
  AgentSession,
  AgentStoppedError,
  createProvider,
  LiveMainStrategy,
  runLlmAgent,
  runScriptedAgent,
  type AgentResult,
  type LlmAgentState,
  type SessionSnapshot,
  type ToolOutcome,
} from '@livemain/agent';
import { EXTERNAL_APPROVAL_WAIT_MS, SEAT_IDLE_MS } from '@livemain/api';
import { HttpCoordinatorClient } from '@livemain/core';
import type { Task, Worker } from '@livemain/protocol';
import type { Env } from '../env.js';
import { org, solution, vault, workcells } from './platform.js';

export interface RepoAgentJob {
  repoId: string;
  swarmId: string;
  agentId: string;
  slot: number;
  task: Task;
  worker: Worker;
  workcell: string;
  remote: string;
  thinkMs: number;
  project: string;
}

interface Progress {
  started: boolean;
  session?: SessionSnapshot;
  llm?: LlmAgentState;
}

type Final = { state: 'landed' } | { state: 'gave-up' | 'stopped' | 'error'; detail: string };

/** Wall-clock slice per alarm (alarm handlers stop after 15 minutes). */
const SLICE_MS = 8 * 60 * 1000;

/**
 * One agent of a repository's swarm, reporting its outcome to its RepoDO. Built-in workers run
 * the task through the same AgentSession code as the local runtime, in alarm slices. External
 * workers (Claude Code over `lm mcp`) are seats: the session starts, then each tool call from
 * the claimer restores it, runs, and saves it; the alarm only releases an idle or stopped seat.
 */
export class RepoAgentDO extends DurableObject<Env> {
  private abort = new AbortController();
  /** external tool calls run one at a time */
  private chain: Promise<unknown> = Promise.resolve();

  /** RPC from the repo: start working on a task. */
  async begin(job: RepoAgentJob): Promise<void> {
    await this.ctx.storage.put('job', job);
    await this.ctx.storage.put<Progress>('progress', { started: false });
    await this.ctx.storage.delete('stopped');
    await this.ctx.storage.setAlarm(Date.now());
  }

  /** RPC from the repo: stop at the next tool call (the overlay is kept). */
  async stop(): Promise<void> {
    await this.ctx.storage.put('stopped', true);
    this.abort.abort();
    await this.ctx.storage.setAlarm(Date.now());
  }

  /** RPC from the repo: a client claimed this external agent; release it if it goes quiet. */
  async claimed(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + SEAT_IDLE_MS);
  }

  /** RPC from the repo: one tool call by the external agent's claimer. */
  tool(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
    const run = () => this.runTool(name, input);
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private async runTool(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
    const job = await this.ctx.storage.get<RepoAgentJob>('job');
    const progress = await this.ctx.storage.get<Progress>('progress');
    if (!job || !progress?.started) return { text: 'this agent is not active any more (it landed, gave up, or was stopped)', isError: true };
    const session = this.session(job);
    if (progress.session) session.restore(progress.session);
    await this.ctx.storage.setAlarm(Date.now() + SEAT_IDLE_MS);
    if (name === 'give_up') {
      const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : 'gave up';
      await this.finish(job, session, { state: 'gave-up', detail: reason });
      return { text: 'Given up; the task goes back to the queue for someone else.', isError: false };
    }
    try {
      const out = await session.call(name, input);
      if (session.landed) await this.finish(job, session, { state: 'landed' });
      else await this.ctx.storage.put<Progress>('progress', { started: true, session: session.snapshot() });
      return out;
    } catch (err) {
      if (err instanceof AgentStoppedError || this.abort.signal.aborted) {
        await this.finish(job, session, { state: 'stopped', detail: 'stopped' });
        return { text: 'This agent was stopped.', isError: true };
      }
      throw err;
    }
  }

  override async alarm(): Promise<void> {
    const job = await this.ctx.storage.get<RepoAgentJob>('job');
    if (!job) return;
    const progress = (await this.ctx.storage.get<Progress>('progress')) ?? { started: false };
    const stopped = !!(await this.ctx.storage.get('stopped'));
    if (stopped) this.abort.abort();
    const session = this.session(job);
    if (progress.started && progress.session) session.restore(progress.session);

    if (job.worker.kind === 'external' && progress.started) {
      // A started seat only wakes up to be released: stopped, or idle since the last call.
      await this.finish(job, session, stopped ? { state: 'stopped', detail: 'stopped' } : { state: 'gave-up', detail: 'released: no tool call for 30 minutes' });
      return;
    }

    let final: Final | null = null;
    try {
      if (!progress.started) {
        // An interrupted earlier attempt may have left a workspace behind.
        await session.workcell.deleteWorkspace(session.workspaceId).catch(() => undefined);
        await session.start();
        progress.started = true;
      }
      if (job.worker.kind === 'external') {
        // A seat: wait for a client to claim it (see `tool`).
        await this.ctx.storage.put<Progress>('progress', { started: true, session: session.snapshot() });
        await session.setState('queued', `waiting for ${job.worker.name} to claim it`);
        await this.repo(job).openSeat(job.agentId);
        return;
      }
      let result: AgentResult;
      if (job.worker.kind === 'model') {
        const key = await this.env.ORG.get(this.env.ORG.idFromName(org(this.env))).sealedKey(job.worker.provider);
        if (!key) throw new Error(`no ${job.worker.provider} key`);
        const provider = createProvider({ provider: job.worker.provider, apiKey: await vault(this.env).open(key.sealed), baseUrl: key.baseUrl });
        const out = await runLlmAgent(session, { provider, model: job.worker.model, resume: progress.llm, deadline: Date.now() + SLICE_MS, project: job.project });
        if (out.outcome === 'paused') {
          await this.ctx.storage.put<Progress>('progress', { started: true, session: session.snapshot(), llm: out.state });
          await this.ctx.storage.setAlarm(Date.now());
          return;
        }
        result = out;
      } else {
        const sol = await solution(this.env, job.task.id);
        if (!sol) throw new Error(`no reference solution for ${job.task.id}`);
        const think = job.thinkMs;
        result = await runScriptedAgent(session, { solution: sol, naive: await solution(this.env, job.task.id, true), thinkMs: () => (think > 0 ? Math.round(think * (0.5 + Math.random())) : 0) });
      }
      final = session.landed ? { state: 'landed' } : { state: 'gave-up', detail: result.reason };
    } catch (err) {
      final = err instanceof AgentStoppedError || this.abort.signal.aborted ? { state: 'stopped', detail: 'stopped' } : { state: 'error', detail: err instanceof Error ? err.message : String(err) };
    }
    await this.finish(job, session, final);
  }

  private repo(job: RepoAgentJob) {
    return this.env.REPO.get(this.env.REPO.idFromName(job.repoId));
  }

  private session(job: RepoAgentJob): AgentSession {
    const repo = this.repo(job);
    const coordinator = new HttpCoordinatorClient('http://repo/coordinator', (input, init) => repo.fetch(new Request(input, init)));
    const wc = workcells(this.env).find((w) => w.name === job.workcell);
    if (!wc) throw new Error(`no workcell ${job.workcell}`);
    return new AgentSession({
      agentId: job.agentId,
      task: job.task,
      strategy: new LiveMainStrategy(job.worker.kind === 'external' ? { approvalWaitMs: EXTERNAL_APPROVAL_WAIT_MS } : {}),
      workcell: wc.client,
      workcellName: wc.name,
      coordinator,
      remote: job.remote,
      snapshot: { remote: job.remote },
      signal: this.abort.signal,
    });
  }

  /** Record the outcome, close the session, tell the repo, and forget the job. */
  private async finish(job: RepoAgentJob, session: AgentSession, final: Final): Promise<void> {
    if (final.state !== 'landed') {
      await session.setState(final.state, final.detail).catch(() => undefined);
      await session.coordinator.finish(job.agentId, final.state === 'gave-up' ? 'gave-up' : 'failed').catch(() => undefined);
    }
    await session.close();
    await this.repo(job).report(job.swarmId, job.agentId, job.slot, job.task.id, session.landed);
    await this.ctx.storage.deleteAll();
  }
}
