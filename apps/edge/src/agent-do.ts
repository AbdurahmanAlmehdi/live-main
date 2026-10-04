import { DurableObject } from 'cloudflare:workers';
import {
  AgentSession,
  AnthropicProvider,
  createStrategy,
  runLlmAgent,
  runScriptedAgent,
  type AgentResult,
  type LlmAgentState,
  type SessionSnapshot,
} from '@livemain/agent';
import type { Solution, StrategyName, Task } from '@livemain/protocol';
import { coordinatorClient, workcellClient, workcellName } from './clients.js';
import { authedRepoRemote, type Env } from './env.js';

export interface AgentJob {
  runId: string;
  agentId: string;
  slot: number;
  workcells: number;
  task: Task;
  strategy: StrategyName;
  remote: string;
  mode: 'scripted' | 'llm';
  thinkMs: number;
  model?: string;
}

interface Progress {
  started: boolean;
  /** where this agent's overlay snapshots go (its Artifacts fork, or main's repo) */
  snapshotRemote?: string;
  session?: SessionSnapshot;
  llm?: LlmAgentState;
}

/** Wall-clock slice per alarm; alarms are limited to 15 minutes. */
const SLICE_MS = 8 * 60 * 1000;

/**
 * One swarm worker. Runs a single task through the same AgentSession/strategy code as
 * the local runner, in alarm-driven slices so long LLM sessions survive alarm limits.
 */
export class SwarmAgentDO extends DurableObject<Env> {
  /** RPC from the run: start working on a task. */
  async begin(job: AgentJob): Promise<void> {
    await this.ctx.storage.put('job', job);
    await this.ctx.storage.put<Progress>('progress', { started: false });
    await this.ctx.storage.setAlarm(Date.now());
  }

  override async alarm(): Promise<void> {
    const job = await this.ctx.storage.get<AgentJob>('job');
    const progress = (await this.ctx.storage.get<Progress>('progress')) ?? { started: false };
    if (!job) return;
    const wc = workcellName(job.runId, job.slot % job.workcells);
    const coordinator = coordinatorClient(this.env, job.runId);
    if (job.strategy === 'live-main' && !progress.snapshotRemote) progress.snapshotRemote = await this.snapshotRemote(job);
    const session = new AgentSession({
      agentId: job.agentId,
      task: job.task,
      strategy: createStrategy(job.strategy),
      workcell: workcellClient(this.env, wc, 'workcell'),
      workcellName: wc,
      coordinator,
      remote: job.remote,
      snapshot: progress.snapshotRemote ? { remote: progress.snapshotRemote } : undefined,
    });

    if (this.env.LIVEMAIN_DEBUG) {
      const inner = session.call.bind(session);
      session.call = async (name, input) => {
        console.log(`agent ${job.agentId} → ${name} ${JSON.stringify(input).slice(0, 80)}`);
        const out = await inner(name, input);
        console.log(`agent ${job.agentId} ← ${name} ${out.isError ? 'ERR' : 'ok'} ${out.text.slice(0, 80)}`);
        return out;
      };
    }
    let result: AgentResult;
    try {
      if (!progress.started) {
        // An interrupted earlier attempt (DO reset, deploy) may have left a workspace behind.
        await session.workcell.deleteWorkspace(session.workspaceId).catch(() => undefined);
        await session.start();
        progress.started = true;
      } else if (progress.session) {
        session.restore(progress.session);
      }
      if (job.mode === 'llm') {
        const out = await runLlmAgent(session, {
          provider: new AnthropicProvider({ apiKey: this.env.ANTHROPIC_API_KEY }),
          model: job.model ?? this.env.WORKER_MODEL,
          resume: progress.llm,
          deadline: Date.now() + SLICE_MS,
          project: 'a TypeScript spreadsheet formula engine',
        });
        if (out.outcome === 'paused') {
          await this.ctx.storage.put<Progress>('progress', { started: true, snapshotRemote: progress.snapshotRemote, session: session.snapshot(), llm: out.state });
          await this.ctx.storage.setAlarm(Date.now());
          return;
        }
        result = out;
      } else {
        const solution = await this.loadSolution(job.task.id);
        if (!solution) throw new Error(`no reference solution for ${job.task.id}`);
        result = await runScriptedAgent(session, {
          solution,
          naive: await this.loadSolution(job.task.id, true),
          thinkMs: () => (job.thinkMs > 0 ? Math.round(job.thinkMs * (0.5 + Math.random())) : 0),
        });
      }
    } catch (err) {
      console.error(`agent ${job.agentId} failed: ${err instanceof Error ? err.stack : String(err)}`);
      result = { outcome: 'failed', turns: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reason: String(err) };
    }

    await coordinator.emit({
      type: 'agent.usage',
      agentId: job.agentId,
      taskId: job.task.id,
      inputTokens: result.inputTokens + result.cacheReadTokens + result.cacheWriteTokens,
      outputTokens: result.outputTokens,
      toolCalls: session.stats.toolCalls,
      interrupts: session.stats.interrupts,
      falseInterrupts: session.stats.falseInterrupts,
      at: Date.now(),
    });
    if (!session.landed) await coordinator.finish(job.agentId, result.outcome === 'gave-up' ? 'gave-up' : 'failed').catch(() => undefined);
    await session.close();
    const outcome = session.landed ? 'landed' : result.outcome;
    const run = this.env.RUN.get(this.env.RUN.idFromName(job.runId));
    await run.report(job.agentId, job.slot, job.task.id, outcome);
    await this.ctx.storage.deleteAll();
  }

  /**
   * With Artifacts, each agent publishes its overlay to its own fork of the run's main repo
   * (cloneable, reviewable work in progress). Otherwise snapshots go to refs/heads/overlay/<agent>
   * on main's repo.
   */
  private async snapshotRemote(job: AgentJob): Promise<string> {
    if (!this.env.ARTIFACTS) return job.remote;
    try {
      using main = await this.env.ARTIFACTS.get(`lm-${job.runId}`);
      return authedRepoRemote(await main.fork(`lm-${job.runId}-${job.agentId}`.slice(0, 100), { description: `overlay of ${job.agentId}` }));
    } catch {
      return job.remote;
    }
  }

  private async loadSolution(taskId: string, naive = false): Promise<Solution | undefined> {
    const res = await this.env.ASSETS.fetch(`http://assets/bench/solutions/${taskId}${naive ? '.naive' : ''}.json`);
    // A missing asset comes back as the web app's index.html (single-page-app serving).
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return undefined;
    return (await res.json()) as Solution;
  }
}
