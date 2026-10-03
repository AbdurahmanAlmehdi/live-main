import type { RunEvent, StrategyName, Task } from '@livemain/protocol';
import { Scheduler } from './scheduler.js';

export interface RunTaskContext {
  task: Task;
  /** agent slot 0..concurrency-1 (maps to a workcell) */
  slot: number;
  /** unique per attempt */
  agentId: string;
}

export type TaskOutcome = 'landed' | 'failed' | 'gave-up';

export interface SwarmOptions {
  runId: string;
  strategy: StrategyName;
  tasks: Task[];
  concurrency: number;
  runTask: (ctx: RunTaskContext) => Promise<TaskOutcome>;
  emit: (event: RunEvent) => Promise<void> | void;
  now?: () => number;
  /** called right after run.started is emitted, before any task starts (e.g. baseline CI) */
  onStarted?: () => Promise<void>;
  /** called when the run has no more work, before run.finished */
  onDrained?: () => Promise<void>;
  log?: (line: string) => void;
  /** planner hook: returns the tasks that currently count as contract work (called after every finish) */
  replan?: (tasks: Task[]) => Promise<Iterable<string>> | Iterable<string>;
  /**
   * Awaited before each launch: resolve 'go' to launch, stay pending to pause, 'stop' to
   * launch nothing more (in-flight agents finish or are aborted by the caller).
   */
  gate?: () => Promise<'go' | 'stop'>;
}

export interface SwarmSummary {
  runId: string;
  strategy: StrategyName;
  startedAt: number;
  finishedAt: number;
  counts: ReturnType<Scheduler['counts']>;
}

/** Runs every task with at most `concurrency` agents in flight, honoring the scheduler's order. */
export async function runSwarm(opts: SwarmOptions): Promise<SwarmSummary> {
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? (() => undefined);
  const scheduler = new Scheduler(opts.tasks);
  const replan = async () => {
    if (opts.replan) scheduler.setContracts(await opts.replan(opts.tasks));
  };
  await replan();
  const startedAt = now();
  await opts.emit({
    type: 'run.started',
    runId: opts.runId,
    strategy: opts.strategy,
    agents: opts.concurrency,
    tasks: opts.tasks.length,
    taskIds: opts.tasks.map((t) => t.id),
    at: startedAt,
  });
  await opts.onStarted?.();

  const freeSlots = Array.from({ length: opts.concurrency }, (_, i) => opts.concurrency - 1 - i);
  const inflight = new Map<number, Promise<void>>();
  let attempt = 0;

  const emitReleases = async () => {
    for (const co of scheduler.takeReleased()) await opts.emit({ type: 'change-order.released', taskId: co.id, at: now() });
  };

  const launch = (task: Task, slot: number) => {
    const agentId = `${opts.runId}-a${slot}-${task.id}-${attempt++}`;
    const p = (async () => {
      let outcome: TaskOutcome = 'failed';
      try {
        outcome = await opts.runTask({ task, slot, agentId });
      } catch (err) {
        log(`task ${task.id} crashed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      }
      scheduler.finish(task.id, outcome === 'landed' ? 'landed' : 'failed');
      await replan().catch((err) => log(`replan failed: ${String(err)}`));
      await emitReleases();
      const c = scheduler.counts();
      log(`${outcome.padEnd(7)} ${task.id}  [landed ${c.landed} failed ${c.failed} blocked ${c.blocked} running ${c.running} pending ${c.pending}]`);
      freeSlots.push(slot);
      inflight.delete(slot);
    })();
    inflight.set(slot, p);
  };

  let stopping = false;
  const mayLaunch = async () => {
    if (!stopping && opts.gate && (await opts.gate()) === 'stop') stopping = true;
    return !stopping;
  };

  for (;;) {
    await emitReleases();
    while (freeSlots.length > 0 && (await mayLaunch())) {
      const task = scheduler.next();
      if (!task) break;
      launch(task, freeSlots.pop()!);
    }
    if (inflight.size === 0) {
      if (stopping) break;
      // Nothing running: progress can no longer change, so release any held change orders.
      scheduler.releaseAll();
      await emitReleases();
      const task = (await mayLaunch()) ? scheduler.next() : null;
      if (!task) break;
      launch(task, freeSlots.pop()!);
      continue;
    }
    await Promise.race(inflight.values());
  }

  await opts.onDrained?.();
  const finishedAt = now();
  await opts.emit({ type: 'run.finished', runId: opts.runId, at: finishedAt });
  return { runId: opts.runId, strategy: opts.strategy, startedAt, finishedAt, counts: scheduler.counts() };
}
