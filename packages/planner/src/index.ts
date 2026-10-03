import { sigdiff } from '@livemain/sigdiff';
import type { ChangeClass, Task } from '@livemain/protocol';
import { CLASS_RANK } from '@livemain/protocol';

/** A file of the repository snapshot: repo-relative path and text. */
export interface SourceFile {
  path: string;
  text: string;
}

/** One historical commit: for each changed path, the old and new text (null = absent). */
export interface HistoryCommit {
  changes: { path: string; before: string | null; after: string | null }[];
}

export interface FileScore {
  path: string;
  /** files that (transitively) import this file */
  dependents: number;
  /** fraction of commits touching this file */
  churn: number;
  /** max change class ever seen for this file in history */
  maxClass: ChangeClass;
  /** every historical change was additive or cosmetic (registries, barrels, route tables) */
  appendOnly: boolean;
  /** load-bearing score in [0, 1+] */
  score: number;
  loadBearing: boolean;
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

/** Resolve relative imports to repo paths (TS/JS, with or without extension, index files). */
export function importGraph(files: SourceFile[]): Map<string, Set<string>> {
  const known = new Set(files.map((f) => f.path));
  const graph = new Map<string, Set<string>>();
  for (const f of files) {
    const deps = new Set<string>();
    for (const m of f.text.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec || !spec.startsWith('.')) continue;
      const resolved = resolveImport(f.path, spec, known);
      if (resolved) deps.add(resolved);
    }
    graph.set(f.path, deps);
  }
  return graph;
}

function resolveImport(from: string, spec: string, known: Set<string>): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  const base = parts.join('/').replace(/\.(m|c)?js$/, '');
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`]) {
    if (known.has(cand)) return cand;
  }
  return null;
}

/** Number of files that depend on each file, transitively. */
export function transitiveDependents(graph: Map<string, Set<string>>): Map<string, number> {
  const reverse = new Map<string, Set<string>>();
  for (const [file, deps] of graph) for (const d of deps) (reverse.get(d) ?? reverse.set(d, new Set()).get(d)!).add(file);
  const out = new Map<string, number>();
  for (const file of graph.keys()) {
    const seen = new Set<string>();
    const stack = [...(reverse.get(file) ?? [])];
    while (stack.length > 0) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      for (const r of reverse.get(f) ?? []) stack.push(r);
    }
    out.set(file, seen.size);
  }
  return out;
}

/**
 * Score load-bearing code: high transitive fan-in × (1 + churn). Files whose entire
 * history is additive (per entity-level sigdiff) are append-only hot spots: they get
 * concurrent edits, but those merge automatically, so they are not contracts.
 */
export function scoreFiles(
  files: SourceFile[],
  history: HistoryCommit[] = [],
  threshold = 0.25,
  /** classes per path already known (e.g. from the coordinator's version log), one entry per change */
  classHistory: Record<string, ChangeClass[]> = {},
): FileScore[] {
  const graph = importGraph(files);
  const dependents = transitiveDependents(graph);
  const codeFiles = files.filter((f) => /\.(m|c)?(t|j)sx?$/.test(f.path)).length || 1;
  const touched = new Map<string, number>();
  const maxCls = new Map<string, ChangeClass>();
  for (const c of history) {
    for (const ch of c.changes) {
      touched.set(ch.path, (touched.get(ch.path) ?? 0) + 1);
      const cls = sigdiff(ch.before, ch.after, ch.path).class;
      const prev = maxCls.get(ch.path) ?? 'none';
      if (CLASS_RANK[cls] > CLASS_RANK[prev]) maxCls.set(ch.path, cls);
    }
  }
  for (const [path, classes] of Object.entries(classHistory)) {
    for (const cls of classes) {
      touched.set(path, (touched.get(path) ?? 0) + 1);
      const prev = maxCls.get(path) ?? 'none';
      if (CLASS_RANK[cls] > CLASS_RANK[prev]) maxCls.set(path, cls);
    }
  }
  const commits = Math.max(history.length, ...Object.values(classHistory).map((c) => c.length), 1);
  return files
    .map((f) => {
      const dep = dependents.get(f.path) ?? 0;
      const churn = (touched.get(f.path) ?? 0) / commits;
      const maxClass = maxCls.get(f.path) ?? 'none';
      const appendOnly = (touched.get(f.path) ?? 0) > 0 && CLASS_RANK[maxClass] <= CLASS_RANK.additive;
      const score = (dep / codeFiles) * (1 + churn);
      return { path: f.path, dependents: dep, churn, maxClass, appendOnly, score, loadBearing: score >= threshold && !appendOnly };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Mark tasks that touch load-bearing files as contract changes, so the scheduler lands
 * them before the features that depend on them (phases: foundation before trades).
 */
export function tagContracts(tasks: Task[], scores: FileScore[]): Task[] {
  const lb = new Set(scores.filter((s) => s.loadBearing).map((s) => s.path));
  return tasks.map((t) => {
    const hits = (t.expectedFiles ?? []).filter((p) => lb.has(p));
    return hits.length > 0 && !t.contract ? { ...t, contract: true } : t;
  });
}
