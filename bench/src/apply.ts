/**
 * Landing tasks on a workspace the way a scripted swarm would: a dependency-respecting
 * order, change orders inserted at their release position, and for every task the
 * solution variant matching the change orders landed so far.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCH, SOLUTIONS } from './paths.ts';
import { chooseVariant, type Solution, type Task, type TaskBank, type Variant } from './bank.ts';
import { applyOps } from './ops.ts';

export function loadBank(): TaskBank {
  return JSON.parse(readFileSync(join(BENCH, 'tasks.json'), 'utf8')) as TaskBank;
}

const solutionCache = new Map<string, Solution>();

export function loadSolution(key: string): Solution {
  let s = solutionCache.get(key);
  if (!s) {
    s = JSON.parse(readFileSync(join(SOLUTIONS, `${key}.json`), 'utf8')) as Solution;
    solutionCache.set(key, s);
  }
  return s;
}

/** Deterministic PRNG (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A landing order: non-change-order tasks in a seeded random topological order (a task only
 * after everything it depends on), with each change order inserted at round(releaseAt * N).
 * (`reverseChangeOrders` swaps which change order goes in which slot, to show that they
 * commute: in a real run they may land out of release order.)
 */
export function landingOrder(bank: TaskBank, seed = 1, options: { reverseChangeOrders?: boolean } = {}): string[] {
  const rand = random(seed);
  const work = bank.tasks.filter((t) => t.kind !== 'change-order');
  const pending = new Map(work.map((t) => [t.id, new Set(t.dependsOn)]));
  const order: string[] = [];
  while (pending.size > 0) {
    const ready = [...pending.entries()].filter(([, deps]) => deps.size === 0).map(([id]) => id).sort();
    if (ready.length === 0) throw new Error(`dependency cycle among: ${[...pending.keys()].join(', ')}`);
    const pick = ready[Math.floor(rand() * ready.length)];
    order.push(pick);
    pending.delete(pick);
    for (const deps of pending.values()) deps.delete(pick);
  }
  const total = bank.tasks.length;
  const cos = bank.tasks.filter((t) => t.kind === 'change-order').sort((a, b) => (b.releaseAt ?? 0) - (a.releaseAt ?? 0));
  // reverseChangeOrders lands them in the opposite order (same slots), to check they commute
  const ids = options.reverseChangeOrders ? cos.map((c) => c.id).reverse() : cos.map((c) => c.id);
  cos.forEach((co, i) => order.splice(Math.min(order.length, Math.round((co.releaseAt ?? 0) * total)), 0, ids[i]));
  return order;
}

export interface Landing {
  task: Task;
  variant: Variant;
  changed: string[];
}

/** Lands `ids` in order on the workspace. `naive` maps trap ids to their naive solution. */
export function landAll(dir: string, bank: TaskBank, ids: readonly string[], options: { naive?: ReadonlySet<string>; landed?: Set<string> } = {}): Landing[] {
  const byId = new Map(bank.tasks.map((t) => [t.id, t]));
  const landed = options.landed ?? new Set<string>();
  const out: Landing[] = [];
  for (const id of ids) {
    const task = byId.get(id);
    if (!task) throw new Error(`unknown task ${id}`);
    const key = options.naive?.has(id) ? `${id}.naive` : id;
    const variant = chooseVariant(loadSolution(key), landed);
    let changed: string[];
    try {
      changed = applyOps(dir, variant.ops).changed;
    } catch (e) {
      throw new Error(`landing ${key} (variant [${variant.requires.join(',')}]) failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (task.kind === 'change-order') landed.add(id);
    out.push({ task, variant, changed });
  }
  return out;
}

/** Maps test files to the tasks whose `tests` list them. */
export function testOwners(bank: TaskBank): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const t of bank.tasks) for (const f of t.tests) owners.set(f, [...(owners.get(f) ?? []), t.id]);
  return owners;
}
