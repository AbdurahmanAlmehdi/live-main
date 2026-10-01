/**
 * Builds the task bank from the hand-written definitions:
 *   bench/tasks.json, bench/solutions/<taskId>.json (+ <trapId>.naive.json), bench/tasks.summary.md
 *
 * Sources: defs/functions (specs), defs/helpers.ts, defs/change-orders.ts, defs/traps.ts,
 * defs/trap-breaks.json (computed by scripts/compute-breaks.ts), reference/functions,
 * reference/helpers.
 *
 * Usage: tsx scripts/build-bank.ts [--check]   (--check: fail if any output would change)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSpecs } from '../defs/functions/index.ts';
import { HELPERS } from '../defs/helpers.ts';
import { CHANGE_ORDERS } from '../defs/change-orders.ts';
import { TRAPS } from '../defs/traps.ts';
import { fileNameOf, type FnSpec } from '../defs/types.ts';
import { BENCH, DEMO_REPO, REFERENCE, SOLUTIONS } from '../src/paths.ts';
import { REGISTRY_ANCHOR, REGISTRY_PATH, type Op, type Solution, type Task, type TaskBank } from '../src/bank.ts';
import { functionPath, registryLine } from '../src/registry.ts';
import { deriveVariants } from '../src/variants.ts';

const HELPER_IMPORT = /from '\.\.\/\.\.\/helpers\/(\w+)'|from '\.\/(\w+)'/g;

export function helperDeps(source: string, self?: string): string[] {
  const deps = new Set<string>();
  for (const m of source.matchAll(HELPER_IMPORT)) {
    const file = m[1] ?? m[2];
    if (file !== self) deps.add(`helper-${file}`);
  }
  return [...deps].sort();
}

function testPathOf(name: string): string {
  return `tests/functions/${fileNameOf(name)}.test.ts`;
}

function readReferenceFunction(spec: FnSpec): string {
  const path = join(REFERENCE, 'functions', spec.category, `${fileNameOf(spec.name)}.ts`);
  if (!existsSync(path)) throw new Error(`missing reference implementation ${path}`);
  return readFileSync(path, 'utf8');
}

function functionOps(spec: FnSpec, content: string): Op[] {
  return [
    { op: 'write', path: functionPath(spec.name, spec.category), content },
    { op: 'insertBefore', path: REGISTRY_PATH, anchor: REGISTRY_ANCHOR, text: registryLine(spec.name, spec.category) },
  ];
}

function filesOf(ops: readonly Op[]): string[] {
  const files = new Set<string>();
  for (const op of ops) if (op.op !== 'codemod') files.add(op.path);
  return [...files].sort();
}

function leafPrompt(spec: FnSpec): string {
  return [
    `Implement the spreadsheet function ${spec.name}: ${spec.summary}`,
    `Signature: ${spec.signature}.`,
    `Add it as ${functionPath(spec.name, spec.category)} and register it in ${REGISTRY_PATH} (see README.md, "How to add a function").`,
    `Done when ${testPathOf(spec.name)} passes.`,
  ].join('\n');
}

interface Built {
  bank: TaskBank;
  solutions: Map<string, Solution>;
  problems: string[];
}

export function buildBank(): Built {
  const problems: string[] = [];
  const tasks: Task[] = [];
  const solutions = new Map<string, Solution>();
  const trapByFn = new Map(TRAPS.map((t) => [t.fn, t]));
  const helperIds = new Set(HELPERS.map((h) => h.id));
  const breaksPath = join(BENCH, 'defs/trap-breaks.json');
  const trapBreaks: Record<string, string[]> = existsSync(breaksPath) ? JSON.parse(readFileSync(breaksPath, 'utf8')) : {};
  const relevantBy = new Map<string, string[]>(); // taskId -> change orders affecting it

  const addSolution = (taskId: string, base: Op[], key = taskId, exclude?: string) => {
    const { variants, relevant, problems: p } = deriveVariants(base, CHANGE_ORDERS, exclude);
    problems.push(...p.map((x) => `${key}: ${x}`));
    solutions.set(key, { taskId, variants });
    if (key === taskId) relevantBy.set(taskId, relevant);
  };

  // helpers
  for (const h of HELPERS) {
    const content = readFileSync(join(REFERENCE, 'helpers', `${h.file}.ts`), 'utf8');
    const ops: Op[] = [{ op: 'write', path: `src/helpers/${h.file}.ts`, content }];
    tasks.push({
      id: h.id,
      kind: 'helper',
      title: h.title,
      prompt: [
        h.ask,
        `The module src/helpers/${h.file}.ts exists with documented signatures whose bodies throw NotImplementedError; implement them to the documented contract.`,
        `Done when tests/helpers/${h.file}.test.ts passes.`,
      ].join('\n'),
      tests: [`tests/helpers/${h.file}.test.ts`],
      dependsOn: helperDeps(content, h.file),
      category: h.category,
      expectedFiles: filesOf(ops),
      contract: false,
    });
    addSolution(h.id, ops);
  }

  // functions (leaves and traps)
  for (const spec of allSpecs) {
    const content = readReferenceFunction(spec);
    const trap = trapByFn.get(spec.name);
    const deps = helperDeps(content).filter((d) => {
      if (!helperIds.has(d)) problems.push(`${spec.name} imports unknown helper ${d}`);
      return helperIds.has(d);
    });
    if (!trap) {
      const id = `fn-${spec.name}`;
      const ops = functionOps(spec, content);
      tasks.push({ id, kind: 'leaf', title: `Implement ${spec.name}`, prompt: leafPrompt(spec), tests: [testPathOf(spec.name)], dependsOn: deps, category: spec.category, expectedFiles: filesOf(ops), contract: false });
      addSolution(id, ops);
      continue;
    }
    const sharedHelper = trap.shared.startsWith('src/helpers/') ? `helper-${trap.shared.slice('src/helpers/'.length, -3)}` : undefined;
    const dependsOn = [...new Set([...deps, ...(sharedHelper ? [sharedHelper] : [])])].sort();
    let naiveContent = content;
    for (const [from, to] of trap.naiveFunction) {
      if (!naiveContent.includes(from)) problems.push(`${trap.id}: naiveFunction replacement not found: ${from}`);
      naiveContent = naiveContent.replace(from, to);
    }
    if (trap.naiveFunction.length > 0 && naiveContent === content) problems.push(`${trap.id}: naive function identical to reference`);
    const refOps = [...functionOps(spec, content), ...trap.reference];
    const naiveOps = [...functionOps(spec, naiveContent), ...trap.naive];
    tasks.push({
      id: trap.id,
      kind: 'trap',
      title: trap.title,
      prompt: leafPrompt(spec),
      tests: [testPathOf(spec.name)],
      dependsOn,
      category: spec.category,
      expectedFiles: filesOf(refOps),
      contract: false,
      breaks: trapBreaks[trap.id] ?? [],
    });
    if (!trapBreaks[trap.id]) problems.push(`${trap.id}: no computed breaks (run scripts/compute-breaks.ts)`);
    addSolution(trap.id, refOps);
    addSolution(trap.id, naiveOps, `${trap.id}.naive`);
  }
  for (const t of TRAPS) if (!allSpecs.some((s) => s.name === t.fn)) problems.push(`${t.id}: no spec for ${t.fn}`);

  // change orders
  for (const co of CHANGE_ORDERS) {
    const ops: Op[] = [...co.edits, ...co.codemods, { op: 'write', path: co.test.path, content: co.test.content }];
    addSolution(co.id, ops, co.id, co.id);
  }
  for (const co of CHANGE_ORDERS) {
    const affected = [...relevantBy.entries()].filter(([, cos]) => cos.includes(co.id)).map(([id]) => id).sort();
    const ops = solutions.get(co.id)!.variants[0].ops;
    tasks.push({
      id: co.id,
      kind: 'change-order',
      title: co.title,
      prompt: `${co.ask}\nDone when ${co.test.path} and the rest of the suite pass.`,
      tests: [co.test.path],
      dependsOn: [],
      category: 'core',
      expectedFiles: [...new Set([...co.coreFiles, ...filesOf(ops)])].sort(),
      releaseAt: co.releaseAt,
      contract: true,
      breaks: affected,
    });
  }

  addTestFunctionDeps(tasks);

  const ids = new Set<string>();
  for (const t of tasks) {
    if (ids.has(t.id)) problems.push(`duplicate task id ${t.id}`);
    ids.add(t.id);
  }
  for (const t of tasks) for (const d of t.dependsOn) if (!ids.has(d)) problems.push(`${t.id} depends on unknown task ${d}`);
  return { bank: { version: 1, tasks }, solutions, problems };
}

/**
 * A function's tests may call other functions (e.g. `=COS(PI())`): those functions must land
 * first, or the test can never pass on its own. Derive these edges from the formulas in each
 * test file; edges that would create a cycle are dropped (bank order wins).
 */
const FORMULA = /evaluate\(\s*(['"`])(=[\s\S]*?)\1/g;
const CALL = /([A-Z][A-Z0-9]*(?:\.[A-Z0-9]+)*)\s*\(/g;

export function functionsCalled(testSource: string): string[] {
  const out = new Set<string>();
  for (const m of testSource.matchAll(FORMULA)) for (const c of (m[2] ?? '').matchAll(CALL)) out.add(c[1]!);
  return [...out];
}

export const droppedCycles: string[] = [];

function addTestFunctionDeps(tasks: Task[]): void {
  const fnTask = new Map<string, Task>();
  for (const spec of allSpecs) {
    const t = tasks.find((x) => x.tests.includes(testPathOf(spec.name)) && (x.kind === 'leaf' || x.kind === 'trap'));
    if (t) fnTask.set(spec.name, t);
  }
  const reaches = (from: string, to: string): boolean => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === to) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(byId.get(id)?.dependsOn ?? []));
    }
    return false;
  };
  for (const [name, task] of fnTask) {
    const file = join(DEMO_REPO, testPathOf(name));
    if (!existsSync(file)) continue;
    for (const called of functionsCalled(readFileSync(file, 'utf8'))) {
      const dep = fnTask.get(called);
      if (!dep || dep.id === task.id || task.dependsOn.includes(dep.id)) continue;
      if (reaches(dep.id, task.id)) {
        // would create a cycle: both tests need both functions
        droppedCycles.push(`${task.id} ↔ ${dep.id}`);
        continue;
      }
      task.dependsOn = [...task.dependsOn, dep.id].sort();
    }
  }
}

// ------------------------------------------------------------------ summary

function depth(tasks: readonly Task[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, number>();
  const visit = (id: string, stack: string[]): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.includes(id)) throw new Error(`dependency cycle: ${[...stack, id].join(' -> ')}`);
    const t = byId.get(id)!;
    const d = t.dependsOn.length === 0 ? 0 : 1 + Math.max(...t.dependsOn.map((x) => visit(x, [...stack, id])));
    memo.set(id, d);
    return d;
  };
  for (const t of tasks) visit(t.id, []);
  return memo;
}

export function renderSummary(bank: TaskBank, solutions: Map<string, Solution>): string {
  const tasks = bank.tasks;
  const kinds = ['leaf', 'helper', 'change-order', 'trap'] as const;
  const categories = [...new Set(tasks.map((t) => t.category))].sort();
  const depths = depth(tasks);
  const lines: string[] = [];
  lines.push('# Task bank summary', '', `Generated by \`scripts/build-bank.ts\`. ${tasks.length} tasks.`, '');
  lines.push('## Counts by kind and category', '');
  lines.push(`| category | ${kinds.join(' | ')} | total |`, `|---|${kinds.map(() => '---:').join('|')}|---:|`);
  for (const c of categories) {
    const row = kinds.map((k) => tasks.filter((t) => t.category === c && t.kind === k).length);
    lines.push(`| ${c} | ${row.join(' | ')} | ${row.reduce((a, b) => a + b, 0)} |`);
  }
  const totals = kinds.map((k) => tasks.filter((t) => t.kind === k).length);
  lines.push(`| **total** | ${totals.join(' | ')} | ${tasks.length} |`, '');

  lines.push('## Dependency depth', '', 'Depth 0 = no dependencies; depth n = longest chain of `dependsOn` below the task.', '');
  const maxDepth = Math.max(...depths.values());
  lines.push('| depth | tasks | examples |', '|---:|---:|---|');
  for (let d = 0; d <= maxDepth; d++) {
    const at = tasks.filter((t) => depths.get(t.id) === d);
    lines.push(`| ${d} | ${at.length} | ${at.slice(0, 6).map((t) => t.id).join(', ')}${at.length > 6 ? ', ...' : ''} |`);
  }
  const deepest = tasks.filter((t) => depths.get(t.id) === maxDepth).map((t) => t.id);
  lines.push('', `Deepest chains end at: ${deepest.join(', ')}.`, '');
  const fanIn = new Map<string, number>();
  for (const t of tasks) for (const d of t.dependsOn) fanIn.set(d, (fanIn.get(d) ?? 0) + 1);
  lines.push('Most depended-on tasks:', '');
  for (const [id, n] of [...fanIn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) lines.push(`- \`${id}\`: ${n} dependents`);
  lines.push('');

  lines.push('## Tasks touching `src/core/registry.ts`', '');
  const registryTasks = tasks.filter((t) => t.expectedFiles.includes(REGISTRY_PATH));
  lines.push(`${registryTasks.length} tasks add one line each before the marker comment (every leaf and trap): the deliberate concurrent-append hot spot.`, '');
  lines.push(`By kind: ${kinds.map((k) => `${k} ${registryTasks.filter((t) => t.kind === k).length}`).join(', ')}.`, '');

  lines.push('## Change-order release schedule', '');
  lines.push('| releaseAt | id | core files | affected tasks (variants) | title |', '|---:|---|---|---:|---|');
  for (const t of tasks.filter((x) => x.kind === 'change-order').sort((a, b) => (a.releaseAt ?? 0) - (b.releaseAt ?? 0))) {
    const core = t.expectedFiles.filter((f) => f.startsWith('src/'));
    lines.push(`| ${t.releaseAt} | \`${t.id}\` | ${core.join(', ')} | ${t.breaks?.length ?? 0} | ${t.title} |`);
  }
  lines.push('');
  lines.push('## Traps', '');
  lines.push('| id | shared module | breaks (if the naive version lands after them) |', '|---|---|---|');
  for (const trap of TRAPS) {
    const t = tasks.find((x) => x.id === trap.id)!;
    lines.push(`| \`${t.id}\` | ${trap.shared} | ${t.breaks?.length ?? 0}: ${(t.breaks ?? []).slice(0, 8).join(', ')}${(t.breaks?.length ?? 0) > 8 ? ', ...' : ''} |`);
  }
  lines.push('');
  const variantCounts = [...solutions.entries()].filter(([k]) => !k.endsWith('.naive')).map(([, s]) => s.variants.length);
  lines.push('## Solution variants', '');
  lines.push(`${variantCounts.reduce((a, b) => a + b, 0)} variants over ${variantCounts.length} solutions; ${variantCounts.filter((n) => n > 1).length} solutions have more than one (max ${Math.max(...variantCounts)}).`, '');
  return lines.join('\n');
}

function main(): void {
  const check = process.argv.includes('--check');
  const { bank, solutions, problems } = buildBank();
  for (const p of problems) console.error(`problem: ${p}`);
  const outputs = new Map<string, string>();
  outputs.set(join(BENCH, 'tasks.json'), JSON.stringify(bank, null, 2) + '\n');
  for (const [key, solution] of solutions) outputs.set(join(SOLUTIONS, `${key}.json`), JSON.stringify(solution, null, 2) + '\n');
  outputs.set(join(BENCH, 'tasks.summary.md'), renderSummary(bank, solutions));
  let changed = 0;
  for (const [path, content] of outputs) {
    if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
    changed++;
  }
  const stale = existsSync(SOLUTIONS) ? readdirSync(SOLUTIONS).filter((f) => !outputs.has(join(SOLUTIONS, f))) : [];
  if (!check) {
    mkdirSync(SOLUTIONS, { recursive: true });
    for (const f of stale) rmSync(join(SOLUTIONS, f));
    for (const [path, content] of outputs) writeFileSync(path, content);
  }
  const counts = ['leaf', 'helper', 'change-order', 'trap'].map((k) => `${k} ${bank.tasks.filter((t) => t.kind === k).length}`).join(', ');
  console.log(`${bank.tasks.length} tasks (${counts}); ${solutions.size} solution files; ${changed + stale.length} ${check ? 'out of date' : 'written/removed'}`);
  if (droppedCycles.length > 0) console.log(`test-dependency cycles (tests need each other): ${droppedCycles.join(', ')}`);
  if (problems.length > 0 || (check && changed + stale.length > 0)) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
