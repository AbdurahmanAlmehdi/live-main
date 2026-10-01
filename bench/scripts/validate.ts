/**
 * Validates the task bank end to end against a scratch copy of demo-repo.
 *
 *   1. stubbed state: tests/core green, every tests/functions and tests/helpers file red,
 *      no change-order tests yet, typecheck clean;
 *   2. land every task (dependency order, change orders at their releaseAt position,
 *      variants chosen like a scripted agent would) and require the full suite 100% green,
 *      a clean typecheck, no leftovers of APIs that change orders removed, and a well-formed
 *      registry;
 *   3. traps: landing the naive solution last breaks exactly the tasks listed in `breaks`
 *      (and the trap's own tests still pass); landing the reference solution last breaks
 *      nothing;
 *   4. change orders are observable at runtime: in the final tree, putting back the
 *      pre-change-order variant of every affected task makes each of those tasks fail;
 *   5. no change order landed: every other task, landed with its pre-change-order variant,
 *      passes its own tests (a run may finish before, or select none of, the change orders).
 *
 * Usage: pnpm --filter @livemain/bench validate [--seed N] [--reverse-change-orders] [--write-breaks] [--skip-observability]
 *   --reverse-change-orders  land the change orders in reverse release order (they must commute)
 *   --write-breaks  record the naive breakage of every trap in defs/trap-breaks.json
 *                   (then run build-bank again) instead of checking it
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCH } from '../src/paths.ts';
import { REGISTRY_ANCHOR, REGISTRY_PATH, chooseVariant, type Task, type TaskBank } from '../src/bank.ts';
import { landAll, landingOrder, loadBank, loadSolution, testOwners } from '../src/apply.ts';
import { createWorkspace, type Workspace } from '../src/workspace.ts';
import { runTsc, runVitest, runVitestAsync, type SuiteResult } from '../src/vitest.ts';
import { globToRegExp, listFiles } from '../src/ops.ts';
import { CHANGE_ORDERS } from '../defs/change-orders.ts';

interface Check {
  step: string;
  check: string;
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];
function record(step: string, check: string, ok: boolean, detail: string): void {
  checks.push({ step, check, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${step}] ${check}: ${detail}`);
}

async function pool<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function failingTasks(result: SuiteResult, owners: Map<string, string[]>): { tasks: Set<string>; unowned: string[] } {
  const tasks = new Set<string>();
  const unowned: string[] = [];
  for (const f of result.files) {
    if (f.ok) continue;
    const ids = owners.get(f.file);
    if (ids) ids.forEach((id) => tasks.add(id));
    else unowned.push(f.file);
  }
  return { tasks, unowned };
}

function fmtList(xs: readonly string[], max = 8): string {
  return xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')}, ... (+${xs.length - max})`;
}

// ------------------------------------------------------------------ step 1

function stubbedState(bank: TaskBank): void {
  const ws = createWorkspace('stub');
  try {
    const result = runVitest(ws.dir);
    const core = result.files.filter((f) => f.file.startsWith('tests/core/'));
    const red = result.files.filter((f) => f.file.startsWith('tests/functions/') || f.file.startsWith('tests/helpers/'));
    const coreRed = core.filter((f) => !f.ok);
    record('1 stub', 'tests/core green', coreRed.length === 0 && core.length > 0, `${core.length - coreRed.length}/${core.length} files pass${coreRed.length ? `; failing: ${fmtList(coreRed.map((f) => f.file))}` : ''}`);
    const notRed = red.filter((f) => f.ok);
    const passingCases = red.reduce((n, f) => n + f.passed, 0);
    record('1 stub', 'tests/functions + tests/helpers red', notRed.length === 0, `${red.length - notRed.length}/${red.length} files fail (${passingCases} individual cases pass)${notRed.length ? `; passing files: ${fmtList(notRed.map((f) => f.file))}` : ''}`);
    const present = new Set(listFiles(ws.dir));
    const missing = bank.tasks.filter((t) => t.kind !== 'change-order').flatMap((t) => t.tests).filter((f) => !present.has(f));
    const premature = bank.tasks.filter((t) => t.kind === 'change-order').flatMap((t) => t.tests).filter((f) => present.has(f));
    record('1 stub', 'task tests present (change-order tests absent)', missing.length === 0 && premature.length === 0, missing.length || premature.length ? `missing: ${fmtList(missing)}; premature: ${fmtList(premature)}` : `${bank.tasks.length - 12} task test files present`);
    const tsc = runTsc(ws.dir);
    record('1 stub', 'typecheck', tsc.ok, tsc.ok ? 'tsc --noEmit clean' : tsc.output.split('\n').slice(0, 5).join(' | '));
  } finally {
    ws.dispose();
  }
}

// ------------------------------------------------------------------ step 2

function checkRegistry(dir: string, bank: TaskBank): string[] {
  const text = readFileSync(join(dir, REGISTRY_PATH), 'utf8');
  const lines = text.split('\n');
  const marker = lines.findIndex((l) => l.includes(REGISTRY_ANCHOR));
  const problems: string[] = [];
  if (marker < 0) return ['marker comment missing'];
  if (lines[marker + 1]?.trim() !== '};') problems.push('marker is not the last line inside the object');
  const entries = lines.filter((l) => /^ {2}('[^']+'|\w+): \(\) => import\('\.\.\/functions\/[a-z]+\/\w+'\),$/.test(l));
  const expected = bank.tasks.filter((t) => t.kind === 'leaf' || t.kind === 'trap').length;
  if (entries.length !== expected) problems.push(`${entries.length} registry entries, expected ${expected}`);
  const keys = entries.map((l) => l.trim().split(':')[0]);
  if (new Set(keys).size !== keys.length) problems.push('duplicate registry keys');
  return problems;
}

function residues(dir: string): string[] {
  // the change orders' own tests may mention the names they remove (to assert they are gone)
  const files = listFiles(dir).filter((f) => globToRegExp('src/**/*.ts').test(f) || (globToRegExp('tests/core/**/*.ts').test(f) && !/\/co-[\w-]+\.test\.ts$/.test(f)));
  const found: string[] = [];
  for (const co of CHANGE_ORDERS) {
    for (const f of files) {
      if (co.residue.test(readFileSync(join(dir, f), 'utf8'))) found.push(`${co.id} in ${f}`);
    }
  }
  return found;
}

function fullLanding(bank: TaskBank, seed: number, reverseChangeOrders: boolean): { ws: Workspace; order: string[] } {
  const order = landingOrder(bank, seed, { reverseChangeOrders });
  const ws = createWorkspace('full');
  const landings = landAll(ws.dir, bank, order);
  const variantsUsed = landings.filter((l) => l.variant.requires.length > 0).length;
  const coPositions = order.map((id, i) => [id, i] as const).filter(([id]) => id.startsWith('co-')).map(([id, i]) => `${id}@${i}`);
  record('2 full', 'land all tasks', true, `${order.length} tasks landed (seed ${seed}); ${variantsUsed} used a post-change-order variant; change orders at ${fmtList(coPositions, 12)}`);
  const result = runVitest(ws.dir);
  const failed = result.files.filter((f) => !f.ok);
  record('2 full', 'full suite 100% green', result.ok && result.files.length > 0, `${result.files.length - failed.length}/${result.files.length} files, ${result.passed} tests passed, ${result.failed} failed in ${(result.durationMs / 1000).toFixed(1)}s${failed.length ? `; failing: ${fmtList(failed.map((f) => `${f.file} (${f.failures[0]?.message.slice(0, 80)})`), 6)}` : ''}`);
  const ran = new Set(result.files.map((f) => f.file));
  const notRun = bank.tasks.flatMap((t) => t.tests).filter((f) => !ran.has(f));
  record('2 full', 'every task test ran', notRun.length === 0, notRun.length ? `not run: ${fmtList(notRun)}` : `${bank.tasks.flatMap((t) => t.tests).length} task test files ran`);
  const tsc = runTsc(ws.dir);
  record('2 full', 'typecheck', tsc.ok, tsc.ok ? 'tsc --noEmit clean' : tsc.output.split('\n').slice(0, 6).join(' | '));
  const left = residues(ws.dir);
  record('2 full', 'no removed APIs left', left.length === 0, left.length ? fmtList(left) : `checked ${CHANGE_ORDERS.length} change orders`);
  const reg = checkRegistry(ws.dir, bank);
  record('2 full', 'registry well-formed', reg.length === 0, reg.length ? reg.join('; ') : 'one entry per leaf/trap, marker last');
  return { ws, order };
}

// ------------------------------------------------------------------ step 5

function withoutChangeOrders(bank: TaskBank, seed: number): void {
  const sub: TaskBank = { ...bank, tasks: bank.tasks.filter((t) => t.kind !== 'change-order') };
  const ws = createWorkspace('no-change-orders');
  try {
    const order = landingOrder(sub, seed, { reverseChangeOrders: false });
    landAll(ws.dir, sub, order);
    const result = runVitest(ws.dir);
    const owners = testOwners(sub);
    const { tasks } = failingTasks(result, owners);
    const failed = result.files.filter((f) => !f.ok);
    record(
      '5 no change orders',
      'pre-change-order variants pass their own tests',
      tasks.size === 0 && result.files.length > 0,
      tasks.size === 0
        ? `${sub.tasks.length} tasks landed, ${result.files.length} files green`
        : `failing tasks: ${fmtList([...tasks], 20)}; e.g. ${fmtList(failed.map((f) => `${f.file} (${f.failures[0]?.message.slice(0, 80)})`), 4)}`,
    );
  } finally {
    ws.dispose();
  }
}

// ------------------------------------------------------------------ step 3

interface TrapResult {
  trap: Task;
  naiveBroken: string[];
  naiveUnowned: string[];
  ownOk: boolean;
  refBroken: string[];
  refUnowned: string[];
}

async function traps(bank: TaskBank, order: string[], writeBreaks: boolean): Promise<void> {
  const owners = testOwners(bank);
  const trapTasks = bank.tasks.filter((t) => t.kind === 'trap');
  const results = await pool(trapTasks, 4, async (trap): Promise<TrapResult> => {
    const rest = order.filter((id) => id !== trap.id);
    const run = async (naive: boolean) => {
      const ws = createWorkspace(naive ? 'naive' : 'ref');
      try {
        const landed = new Set<string>();
        landAll(ws.dir, bank, rest, { landed });
        landAll(ws.dir, bank, [trap.id], { naive: naive ? new Set([trap.id]) : undefined, landed });
        return await runVitestAsync(ws.dir);
      } finally {
        ws.dispose();
      }
    };
    const [naive, ref] = await Promise.all([run(true), run(false)]);
    const n = failingTasks(naive, owners);
    const r = failingTasks(ref, owners);
    const ownOk = trap.tests.every((t) => naive.files.find((f) => f.file === t)?.ok);
    n.tasks.delete(trap.id);
    return { trap, naiveBroken: [...n.tasks].sort(), naiveUnowned: n.unowned, ownOk, refBroken: [...r.tasks].sort(), refUnowned: r.unowned };
  });
  if (writeBreaks) {
    const breaks = Object.fromEntries(results.map((r) => [r.trap.id, r.naiveBroken]));
    writeFileSync(join(BENCH, 'defs/trap-breaks.json'), JSON.stringify(breaks, null, 2) + '\n');
    console.log('wrote defs/trap-breaks.json; run build-bank again');
  }
  for (const r of results) {
    const listed = new Set(r.trap.breaks ?? []);
    const missing = r.naiveBroken.filter((id) => !listed.has(id));
    const extra = [...listed].filter((id) => !r.naiveBroken.includes(id));
    const exact = writeBreaks || (missing.length === 0 && extra.length === 0);
    record('3 traps', `${r.trap.id} naive`, r.ownOk && r.naiveBroken.length > 0 && exact,
      `own tests ${r.ownOk ? 'pass' : 'FAIL'}; breaks ${r.naiveBroken.length} tasks (${fmtList(r.naiveBroken, 6)})${r.naiveUnowned.length ? `; also core tests ${fmtList(r.naiveUnowned, 3)}` : ''}${exact ? '' : `; not listed: ${fmtList(missing)}; listed but not broken: ${fmtList(extra)}`}`);
    record('3 traps', `${r.trap.id} reference`, r.refBroken.length === 0 && r.refUnowned.length === 0, r.refBroken.length || r.refUnowned.length ? `breaks ${fmtList([...r.refBroken, ...r.refUnowned])}` : 'everything green');
  }
}

// ------------------------------------------------------------------ step 4

async function observability(bank: TaskBank, order: string[]): Promise<void> {
  const owners = testOwners(bank);
  const cos = bank.tasks.filter((t) => t.kind === 'change-order');
  const allCoIds = new Set(cos.map((c) => c.id));
  await pool(cos, 4, async (co) => {
    const affected = (co.breaks ?? []).filter((id) => {
      const t = bank.tasks.find((x) => x.id === id)!;
      return t.kind === 'leaf' || t.kind === 'helper';
    });
    if (affected.length === 0) {
      record('4 change orders', co.id, false, 'affects no task');
      return;
    }
    const ws = createWorkspace('observe');
    try {
      landAll(ws.dir, bank, order);
      const without = new Set([...allCoIds].filter((id) => id !== co.id));
      for (const id of affected) {
        const variant = chooseVariant(loadSolution(id), without);
        for (const op of variant.ops) {
          if (op.op === 'write') writeFileSync(join(ws.dir, op.path), op.content);
        }
      }
      const files = [...new Set(affected.flatMap((id) => bank.tasks.find((t) => t.id === id)!.tests))];
      const result = await runVitestAsync(ws.dir, files);
      const broken = failingTasks(result, owners).tasks;
      const silent = affected.filter((id) => !broken.has(id));
      record('4 change orders', `${co.id} (release ${co.releaseAt})`, silent.length === 0,
        `stale code fails in ${affected.length - silent.length}/${affected.length} affected tasks${silent.length ? `; unaffected at runtime: ${fmtList(silent)}` : ''}`);
    } finally {
      ws.dispose();
    }
  });
}

// ------------------------------------------------------------------ main

function printSummary(): void {
  const steps = [...new Set(checks.map((c) => c.step))];
  console.log('\n================ validation summary ================');
  console.log('| step | checks | passed | failed |');
  console.log('|---|---:|---:|---:|');
  for (const s of steps) {
    const cs = checks.filter((c) => c.step === s);
    console.log(`| ${s} | ${cs.length} | ${cs.filter((c) => c.ok).length} | ${cs.filter((c) => !c.ok).length} |`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED:`}`);
  for (const f of failed) console.log(`  - [${f.step}] ${f.check}: ${f.detail}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const seedIdx = args.indexOf('--seed');
  const seed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1;
  const writeBreaks = args.includes('--write-breaks');
  const started = Date.now();
  const bank = loadBank();
  const counts = ['leaf', 'helper', 'change-order', 'trap'].map((k) => `${bank.tasks.filter((t) => t.kind === k).length} ${k}`).join(', ');
  console.log(`task bank: ${bank.tasks.length} tasks (${counts})\n`);
  stubbedState(bank);
  const { ws, order } = fullLanding(bank, seed, args.includes('--reverse-change-orders'));
  ws.dispose();
  await traps(bank, order, writeBreaks);
  if (!args.includes('--skip-observability')) await observability(bank, order);
  withoutChangeOrders(bank, seed);
  printSummary();
  console.log(`\n(${((Date.now() - started) / 1000).toFixed(0)}s)`);
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
