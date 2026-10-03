import type { CoordinatorApi } from '@livemain/core';
import type { ChangeClass, FileChange } from '@livemain/protocol';

/**
 * Synthetic agents: scripted, LLM-free clients that exercise the coordinator protocol
 * (register → report read/write sets → checkpoint → promote → on stale: checkpoint and
 * retry) with realistic path distributions. They measure coordinator scale only; there
 * is no git and no test execution behind them (SyntheticIntegrator).
 */
export interface SynthOptions {
  agents: number;
  durationMs: number;
  /** mean think time between protocol operations per agent (ms) */
  thinkMs: number;
  /** number of helper files (shared, read by many) */
  helpers: number;
  /** probability that a task edits a shared helper (body change) */
  pHelperEdit: number;
  /** probability that a task is a contract change to a core file (signature change) */
  pContract: number;
  /** agents start uniformly over this window (ms) to avoid a thundering herd */
  rampMs: number;
  seed: number;
}

export interface OpStats {
  count: number;
  errors: number;
  samples: number[];
}

export interface SynthReport {
  options: SynthOptions;
  transport: string;
  elapsedMs: number;
  ops: Record<string, { count: number; errors: number; p50: number; p95: number; p99: number; max: number; perSec: number }>;
  landed: number;
  stale: number;
  tasksStarted: number;
  totalOpsPerSec: number;
  maxQueue: number;
}

const CORE = ['src/core/value.ts', 'src/core/coerce.ts', 'src/core/args.ts', 'src/core/errors.ts', 'src/core/range.ts', 'src/core/types.ts'];
const REGISTRY = 'src/core/registry.ts';
const EVAL = ['src/eval/evaluate.ts', 'src/eval/parser.ts', 'src/eval/lexer.ts'];

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function runSynthetic(
  client: CoordinatorApi,
  opts: SynthOptions,
  transport: string,
  queueLength: () => number = () => 0,
): Promise<SynthReport> {
  const rand = rng(opts.seed);
  const helpers = Array.from({ length: opts.helpers }, (_, i) => `src/helpers/h${String(i).padStart(3, '0')}.ts`);
  // Zipf-ish popularity: low-index helpers are read by many more agents.
  const pickHelper = () => helpers[Math.floor(helpers.length * rand() ** 2.2)]!;
  const exp = (mean: number) => -Math.log(1 - rand()) * mean;
  const stats = new Map<string, OpStats>();
  const t0 = Date.now();
  const deadline = t0 + opts.durationMs;
  let landed = 0;
  let stale = 0;
  let started = 0;
  let maxQueue = 0;
  let taskSeq = 0;

  const timed = async <T>(op: string, f: () => Promise<T>): Promise<T | undefined> => {
    const s = stats.get(op) ?? { count: 0, errors: 0, samples: [] };
    stats.set(op, s);
    const start = performance.now();
    try {
      const r = await f();
      s.count++;
      s.samples.push(performance.now() - start);
      return r;
    } catch {
      s.errors++;
      return undefined;
    } finally {
      maxQueue = Math.max(maxQueue, queueLength());
    }
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

  const agent = async (i: number) => {
    await sleep(rand() * opts.rampMs);
    while (Date.now() < deadline) {
      const agentId = `synth-${i}-${taskSeq++}`;
      const own = `src/functions/c${i % 9}/F${i}_${taskSeq}.ts`;
      const reads = [REGISTRY, ...CORE.slice(0, 3), ...EVAL, ...Array.from({ length: 3 + Math.floor(rand() * 8) }, pickHelper), own];
      const changes: FileChange[] = [
        { path: own, content: '// synth:additive\nexport default 1;\n' },
        { path: REGISTRY, content: '// synth:additive\n' },
      ];
      const r = rand();
      if (r < opts.pContract) changes.push({ path: CORE[Math.floor(rand() * CORE.length)]!, content: '// synth:signature\n' });
      else if (r < opts.pContract + opts.pHelperEdit) changes.push({ path: pickHelper(), content: '// synth:body\n' });
      const writes = changes.map((c) => c.path);
      const classes = Object.fromEntries(changes.map((c) => [c.path, (/synth:(\w+)/.exec(c.content ?? '')?.[1] ?? 'body') as ChangeClass]));

      const reg = await timed('register', () => client.register({ agentId, taskId: agentId, strategy: 'live-main', workcell: 'synthetic' }));
      if (!reg) continue;
      started++;
      let pin = reg.pin;
      await sleep(exp(opts.thinkMs));
      await timed('reportSets', () => client.reportSets(agentId, reads, writes));
      await sleep(exp(opts.thinkMs));
      for (let attempt = 0; attempt < 6 && Date.now() < deadline; attempt++) {
        const cp = await timed('checkpointBegin', () => client.checkpointBegin(agentId));
        if (cp && cp.to !== cp.from) {
          await timed('checkpointCommit', () => client.checkpointCommit({ agentId, to: cp.to, readSet: reads, writeSet: writes, notices: [] }));
          pin = cp.to;
        }
        await sleep(exp(opts.thinkMs / 2));
        const res = await timed('promote', () =>
          client.promote({ agentId, pin, readSet: reads, writeSet: writes, changes, testsRun: [`tests/${own}`], message: agentId, classes }),
        );
        if (res?.status === 'landed') {
          landed++;
          break;
        }
        if (res?.status === 'stale') stale++;
        await sleep(exp(opts.thinkMs));
      }
    }
  };

  await Promise.all(Array.from({ length: opts.agents }, (_, i) => agent(i)));
  const elapsedMs = Date.now() - t0;
  const ops: SynthReport['ops'] = {};
  let total = 0;
  for (const [op, s] of stats) {
    const sorted = [...s.samples].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
    ops[op] = { count: s.count, errors: s.errors, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: sorted.at(-1) ?? 0, perSec: s.count / (elapsedMs / 1000) };
    total += s.count;
  }
  return { options: opts, transport, elapsedMs, ops, landed, stale, tasksStarted: started, totalOpsPerSec: total / (elapsedMs / 1000), maxQueue };
}

export function renderReport(r: SynthReport): string {
  const lines = [
    `## Synthetic coordinator stress test (${r.transport})`,
    '',
    '> Synthetic: scripted agents with prerecorded change shapes, no LLM, no git or tests behind the integrator. Measures coordinator scale only.',
    '',
    `- agents: **${r.options.agents}**, duration ${(r.elapsedMs / 1000).toFixed(1)} s, mean think ${r.options.thinkMs} ms`,
    `- tasks started ${r.tasksStarted}, **landed ${r.landed}** (${(r.landed / (r.elapsedMs / 1000)).toFixed(1)}/s), stale rejections ${r.stale}`,
    `- total coordinator ops ${r.totalOpsPerSec.toFixed(0)}/s, max promotion queue ${r.maxQueue}`,
    '',
    '| op | count | errors | ops/s | p50 ms | p95 ms | p99 ms | max ms |',
    '|---|---|---|---|---|---|---|---|',
    ...Object.entries(r.ops).map(
      ([op, s]) => `| ${op} | ${s.count} | ${s.errors} | ${s.perSec.toFixed(1)} | ${s.p50.toFixed(1)} | ${s.p95.toFixed(1)} | ${s.p99.toFixed(1)} | ${s.max.toFixed(1)} |`,
    ),
  ];
  return lines.join('\n');
}
