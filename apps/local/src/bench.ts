import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSession, createStrategy, runLlmAgent, runScriptedAgent, type AgentResult } from '@livemain/agent';
import { LocalCoordinatorClient } from '@livemain/core';
import type { Solution, StrategyName, Task, TaskBank } from '@livemain/protocol';
import { computeMetrics, runSwarm, scoreboard, selectTasks, type RunMetrics } from '@livemain/swarm';
import { scoreFiles, tagContracts, type SourceFile } from '@livemain/planner';
import type { ChangeClass } from '@livemain/protocol';
import { CiLoop, handleV1, LocalApi } from '@livemain/api';
import { Hub } from './hub.js';
import { localPlatform } from './platform.js';
import { startServer } from './server.js';
import { buildImage, createRepo, downStack, upStack, type Stack } from './stack.js';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '../../..');
const BENCH_DIR = join(REPO_ROOT, 'bench');

export interface RunOptions {
  strategy: StrategyName;
  agents: number;
  workcells: number;
  tasks: number;
  mode: 'scripted' | 'llm';
  /** scripted mode: simulated model latency per tool call (ms, mean) */
  thinkMs: number;
  model?: string;
  /** model for change-order (contract) tasks, e.g. a stronger model than the workers' */
  coModel?: string;
  runId?: string;
  /** seeds the simulated think times (scheduling itself is deterministic) */
  seed?: number;
  log?: (s: string) => void;
}

/** mulberry32: small deterministic PRNG for reproducible runs. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadBank(): TaskBank {
  return JSON.parse(readFileSync(join(BENCH_DIR, 'tasks.json'), 'utf8')) as TaskBank;
}

export function loadSolution(taskId: string, naive = false): Solution | undefined {
  const file = join(BENCH_DIR, 'solutions', `${taskId}${naive ? '.naive' : ''}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Solution) : undefined;
}

/** Run one strategy end to end on the local stack; returns its metrics. */
export async function runBenchmark(hub: Hub, stack: Stack, opts: RunOptions): Promise<RunMetrics> {
  const log = opts.log ?? console.log;
  const runId = opts.runId ?? `${opts.strategy}-s${opts.seed ?? 1}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
  const tasks: Task[] = selectTasks(loadBank().tasks, opts.tasks);
  const rand = prng(opts.seed ?? 1);
  const remote = await createRepo(stack, runId);
  const { sha } = await stack.integrator.seed(remote, '/seed/demo-repo', 'seed: formula engine skeleton');
  const run = hub.createRun(runId, opts.strategy, stack.integrator, remote);
  run.coord.init(sha);
  const coordinator = new LocalCoordinatorClient(run.coord);
  log(`run ${runId}: ${opts.strategy}, ${tasks.length} tasks, ${opts.agents} agents on ${stack.workcells.length} workcells, mode=${opts.mode}`);

  const repoFiles = readRepoFiles(join(REPO_ROOT, 'demo-repo'));
  const planReport = scoreFiles(repoFiles).filter((f) => f.loadBearing).slice(0, 8);
  log(`planner: load-bearing at seed: ${planReport.map((f) => `${f.path} (${f.dependents} dependents)`).join(', ')}`);

  // CI covers what this run is responsible for: core (incl. change-order tests) + the selected tasks' tests.
  const ciFiles = ['tests/core/', ...new Set(tasks.flatMap((t) => t.tests).filter((f) => !f.startsWith('tests/core/')))];
  const ci = new CiLoop(run.coord, stack.integrator, remote, (s) => log(`  ${s}`), ciFiles);

  const summary = await runSwarm({
    runId,
    strategy: opts.strategy,
    tasks,
    concurrency: opts.agents,
    emit: (e) => void run.coord.emit(e),
    log: (s) => log(`  ${s}`),
    runTask: async ({ task, slot, agentId }) => {
      const wc = stack.workcells[slot % stack.workcells.length]!;
      const session = new AgentSession({
        agentId,
        task,
        strategy: createStrategy(opts.strategy),
        workcell: wc.client,
        workcellName: wc.name,
        coordinator,
        remote,
        // Each agent's overlay is published as refs/heads/overlay/<agent> on the run's repo.
        snapshot: opts.strategy === 'live-main' ? { remote } : undefined,
      });
      let result: AgentResult;
      try {
        await session.start();
        if (opts.mode === 'llm') {
          result = await runLlmAgent(session, { model: task.kind === 'change-order' && opts.coModel ? opts.coModel : opts.model, project: 'a TypeScript spreadsheet formula engine' });
        } else {
          const solution = loadSolution(task.id);
          if (!solution) throw new Error(`no reference solution for ${task.id}`);
          result = await runScriptedAgent(session, {
            solution,
            naive: loadSolution(task.id, true),
            thinkMs: () => (opts.thinkMs > 0 ? Math.round(opts.thinkMs * (0.5 + rand())) : 0),
          });
        }
      } catch (err) {
        log(`  ${agentId} error: ${err instanceof Error ? err.message : String(err)}`);
        result = { outcome: 'failed', turns: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reason: String(err) };
      }
      run.coord.emit({
        type: 'agent.usage',
        agentId,
        taskId: task.id,
        inputTokens: result.inputTokens + result.cacheReadTokens + result.cacheWriteTokens,
        outputTokens: result.outputTokens,
        toolCalls: session.stats.toolCalls,
      interrupts: session.stats.interrupts,
      falseInterrupts: session.stats.falseInterrupts,
        at: Date.now(),
      });
      if (!session.landed) {
        log(`  ${agentId} did not land (${result.outcome}): ${result.reason}`);
        try {
          run.coord.finish(agentId, result.outcome === 'gave-up' ? 'gave-up' : 'failed');
        } catch {
          // agent never registered
        }
      }
      await session.close();
      return session.landed ? 'landed' : result.outcome;
    },
    onStarted: async () => {
      await ci.once(); // baseline CI on the seed
      ci.start();
    },
    onDrained: () => ci.stop(),
    // Adaptive planning: load-bearing = fan-in × churn, minus files whose landed history is append-only.
    replan: (all) => {
      const history: Record<string, ChangeClass[]> = {};
      for (const v of run.coord.versions(1, 100_000)) for (const [p, c] of Object.entries(v.changes)) (history[p] ??= []).push(c);
      return tagContracts(all, scoreFiles(repoFiles, [], 0.25, history))
        .filter((t) => t.contract)
        .map((t) => t.id);
    },
  });

  const events = run.coord.events(0, 1_000_000).map((e) => e.event);
  const metrics = computeMetrics(events);
  const outDir = join(BENCH_DIR, 'runs', runId);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n'));
  writeFileSync(join(outDir, 'metrics.json'), JSON.stringify({ options: { ...opts, log: undefined }, summary, metrics }, null, 2));
  writeFileSync(join(outDir, 'scoreboard.md'), `${scoreboard([metrics])}\n`);
  log(`run ${runId} done: landed ${summary.counts.landed}/${tasks.length} in ${metrics.wallSeconds.toFixed(1)} s → bench/runs/${runId}`);
  return metrics;
}

/** Source files of the seed repo (for the planner's import graph). */
function readRepoFiles(dir: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(p);
      else if (/\.(t|j)s$/.test(entry.name)) out.push({ path: p, text: readFileSync(join(dir, p), 'utf8') });
    }
  };
  walk('');
  return out;
}

// ------------------------------------------------------------------ CLI

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'help';
  const workcells = Number(arg('workcells', '2'));
  if (cmd === 'build') return buildImage(REPO_ROOT);
  if (cmd === 'down') return downStack();
  if (cmd === 'serve') return serve(workcells);
  if (cmd === 'up') {
    await upStack({ workcells });
    console.log(`stack up: gitserver, integrator, ${workcells} workcells`);
    return;
  }
  if (cmd !== 'run' && cmd !== 'compare') {
    console.log(`usage: livemain <build|up|down|serve|run|compare> [options]
  serve: the web app and API v1 at http://localhost:<port> (Docker stack, data in .livemain/)
  --strategy live-main|pr-flow|push-to-branch   (run)
  --agents N       concurrent agents (default 6)
  --workcells M    workcell containers (default 2)
  --tasks K        number of tasks from the bank (default 40)
  --mode scripted|llm   (default scripted; llm needs ANTHROPIC_API_KEY)
  --think-ms T     scripted mode: mean simulated model latency per tool call (default 1500)
  --seed S         seed for simulated latencies (default 1)
  --model ID       llm mode model (default claude-haiku-4-5)
  --co-model ID    llm mode model for change-order tasks (default: same as --model)
  --port P         dashboard port (default 8787)`);
    return;
  }
  const hub = new Hub(join(BENCH_DIR, 'runs', '.db'), join(REPO_ROOT, 'apps/dashboard/dist'));
  const port = Number(arg('port', '8787'));
  const server = await startServer(hub, port);
  console.log(`dashboard: http://localhost:${port}`);
  const stack = await upStack({ workcells });
  const base: Omit<RunOptions, 'strategy'> = {
    agents: Number(arg('agents', '6')),
    workcells,
    tasks: Number(arg('tasks', '40')),
    mode: arg('mode', 'scripted') as RunOptions['mode'],
    thinkMs: Number(arg('think-ms', '1500')),
    model: arg('model', '') || undefined,
    coModel: arg('co-model', '') || undefined,
    seed: Number(arg('seed', '1')),
  };
  const strategies: StrategyName[] = cmd === 'compare' ? ['live-main', 'pr-flow', 'push-to-branch'] : [arg('strategy', 'live-main') as StrategyName];
  const results: RunMetrics[] = [];
  for (const strategy of strategies) results.push(await runBenchmark(hub, stack, { ...base, strategy }));
  const board = scoreboard(results);
  console.log(`\n${board}\n`);
  if (cmd === 'compare') {
    const file = join(BENCH_DIR, 'runs', `compare-${Date.now()}.md`);
    writeFileSync(file, `# Live Main vs baselines\n\n${JSON.stringify({ ...base }, null, 0)}\n\n${board}\n`);
    console.log(`scoreboard → ${file}`);
  }
  if (!process.argv.includes('--keep-serving')) server.close();
}

/** The product: API v1 + web app on the local Docker stack. */
async function serve(workcells: number): Promise<void> {
  const stack = await upStack({ workcells });
  const api = new LocalApi(localPlatform(stack, REPO_ROOT, join(REPO_ROOT, '.livemain')), { thinkMs: Number(arg('think-ms', '900')) });
  const hub = new Hub(join(REPO_ROOT, '.livemain', 'runs'), join(REPO_ROOT, 'apps/web/dist'));
  const port = Number(arg('port', '8787'));
  const server = await startServer(hub, port, { handle: handleV1(api), api });
  console.log(`Live Main: http://localhost:${port}  (API at /v1, ${workcells} workcells)`);
  const shutdown = async () => {
    console.log('stopping swarms…');
    await api.close();
    server.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
