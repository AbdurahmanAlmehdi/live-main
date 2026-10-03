import type { WorkcellClient } from '@livemain/core';
import type {
  ChangeClass,
  CheckpointResult,
  FileChange,
  IntegrateRequest,
  IntegrateResponse,
  OverlayInfo,
  TestRunResult,
  WorkcellNotice,
} from '@livemain/protocol';
import { sigdiff } from '@livemain/sigdiff';

type Tree = Map<string, string>;

/** In-memory git: commits are full trees. */
export class FakeGit {
  private commits = new Map<string, Tree>();
  head: string;
  private n = 0;

  constructor(files: Record<string, string>) {
    this.head = this.commit(new Map(Object.entries(files)));
  }

  commit(tree: Tree): string {
    const sha = `c${++this.n}`;
    this.commits.set(sha, new Map(tree));
    return sha;
  }

  tree(sha: string): Tree {
    const t = this.commits.get(sha);
    if (!t) throw new Error(`unknown commit ${sha}`);
    return t;
  }

  delta(a: string, b: string): string[] {
    const ta = this.tree(a);
    const tb = this.tree(b);
    const out = new Set<string>();
    for (const [p, c] of tb) if (ta.get(p) !== c) out.add(p);
    for (const p of ta.keys()) if (!tb.has(p)) out.add(p);
    return [...out].sort();
  }
}

/** Union merge for pure insertions (same idea as the Go additive-union merge). */
export function unionMerge(base: string, ours: string, theirs: string): string | null {
  const b = base.split('\n');
  const insertsOf = (side: string[]) => {
    // map: base index before which lines were inserted
    const ins = new Map<number, string[]>();
    let i = 0;
    for (const line of side) {
      if (i < b.length && line === b[i]) i++;
      else (ins.get(i) ?? ins.set(i, []).get(i)!).push(line);
    }
    return i === b.length ? ins : null;
  };
  const o = insertsOf(ours.split('\n'));
  const t = insertsOf(theirs.split('\n'));
  if (!o || !t) return null;
  const out: string[] = [];
  for (let i = 0; i <= b.length; i++) {
    out.push(...(o.get(i) ?? []), ...(t.get(i) ?? []));
    if (i < b.length) out.push(b[i]!);
  }
  return out.join('\n');
}

interface Workspace {
  pin: string;
  upper: Map<string, string | null>;
  reads: Set<string>;
  inbox: unknown[];
}

/**
 * Test oracle: `tests/<X>.test.ts` passes iff `src/<X>.ts` exists, contains no
 * `BROKEN` marker, and the registry mentions X; `requires` lets a test depend on a
 * marker string in another file (to model contract changes).
 */
export type Oracle = (view: (p: string) => string | undefined, testFile: string) => string | null;

export const defaultOracle: Oracle = (view, testFile) => {
  const name = /tests\/(.+)\.test\.ts$/.exec(testFile)?.[1];
  if (!name) return `bad test file ${testFile}`;
  const src = view(`src/${name}.ts`);
  if (src === undefined) return `#NAME? src/${name}.ts missing`;
  if (src.includes('BROKEN')) return `${name} broken`;
  if (!(view('src/registry.ts') ?? '').includes(`${name}:`)) return `#NAME? ${name} not registered`;
  const needs = /needs:(\S+)/.exec(src)?.[1];
  if (needs && !(view('src/value.ts') ?? '').includes(needs)) return `${name} expects ${needs} in value.ts`;
  return null;
};

/** In-memory workcell + integrator implementing the subset of the HTTP contract the TS side uses. */
export class FakeWorkcell {
  readonly ws = new Map<string, Workspace>();
  constructor(
    readonly git: FakeGit,
    readonly oracle: Oracle = defaultOracle,
  ) {}

  asClient(): WorkcellClient {
    return this as unknown as WorkcellClient;
  }

  private w(id: string): Workspace {
    const w = this.ws.get(id);
    if (!w) throw new Error(`no workspace ${id}`);
    return w;
  }

  private view(w: Workspace, p: string, log = true): string | undefined {
    if (log) w.reads.add(p);
    if (w.upper.has(p)) return w.upper.get(p) ?? undefined;
    return this.git.tree(w.pin).get(p);
  }

  async health() {
    return { ok: true, role: 'workcell', workspaces: this.ws.size, mergiraf: false };
  }

  async createWorkspace(req: { id: string; kind: string; sha: string }) {
    this.ws.set(req.id, { pin: req.sha, upper: new Map(), reads: new Set(), inbox: [] });
    return { id: req.id, kind: req.kind, path: `/mnt/${req.id}`, sha: req.sha, generation: 1 };
  }

  async deleteWorkspace(id: string) {
    this.ws.delete(id);
    return { ok: true };
  }

  async read(id: string, path: string) {
    const c = this.view(this.w(id), path);
    if (c === undefined) throw Object.assign(new Error(`not found ${path}`), { code: 'not-found' });
    return { content: c, totalLines: c.split('\n').length };
  }

  async write(id: string, path: string, content: string) {
    this.w(id).upper.set(path, content);
    return { ok: true };
  }

  async edit(id: string, path: string, oldString: string, newString: string) {
    const w = this.w(id);
    const c = this.view(w, path);
    if (c === undefined || !c.includes(oldString)) throw new Error('no-match');
    w.upper.set(path, c.replace(oldString, newString));
    return { ok: true, replacements: 1 };
  }

  async remove(id: string, path: string) {
    this.w(id).upper.set(path, null);
    return { ok: true };
  }

  async revert(id: string, path: string) {
    this.w(id).upper.delete(path);
    return { ok: true };
  }

  async list(id: string, path = '') {
    const w = this.w(id);
    const all = new Set([...this.git.tree(w.pin).keys(), ...[...w.upper.entries()].filter(([, v]) => v !== null).map(([k]) => k)]);
    for (const [k, v] of w.upper) if (v === null) all.delete(k);
    return { entries: [...all].filter((p) => p.startsWith(path)).sort().map((p) => ({ path: p, type: 'file' as const })) };
  }

  async grep(id: string, pattern: string) {
    const re = new RegExp(pattern);
    const { entries } = await this.list(id);
    const matches = entries.flatMap((e) =>
      (this.view(this.w(id), e.path, false) ?? '')
        .split('\n')
        .map((text, i) => ({ path: e.path, line: i + 1, text }))
        .filter((m) => re.test(m.text)),
    );
    return { matches, truncated: false };
  }

  async test(id: string, files: string[]): Promise<TestRunResult> {
    const w = this.w(id);
    const results = files.map((f) => {
      const err = this.oracle((p) => this.view(w, p), f);
      return { file: f, ok: err === null, failures: err ? [{ name: f, message: err }] : [] };
    });
    const failed = results.filter((r) => !r.ok).length;
    return { ok: failed === 0, passed: results.length - failed, failed, files: results, output: '', durationMs: 1 };
  }

  async overlay(id: string): Promise<OverlayInfo> {
    const w = this.w(id);
    const base = this.git.tree(w.pin);
    const changes: FileChange[] = [];
    for (const [path, content] of w.upper) if (base.get(path) !== content && !(content === null && !base.has(path))) changes.push({ path, content });
    const classes = Object.fromEntries(changes.map((c) => [c.path, sigdiff(base.get(c.path) ?? null, c.content, c.path).class]));
    return { pinSha: w.pin, generation: 1, readSet: [...w.reads].sort(), writeSet: [...w.upper.keys()].sort(), changes, classes };
  }

  async checkpoint(id: string, toSha: string): Promise<CheckpointResult> {
    const w = this.w(id);
    const from = w.pin;
    const delta = this.git.delta(from, toSha);
    const readSet = [...w.reads].sort();
    const writeSet = [...w.upper.keys()].sort();
    const notices: WorkcellNotice[] = [];
    const base = this.git.tree(from);
    const theirsT = this.git.tree(toSha);
    for (const p of delta) {
      const before = base.get(p) ?? null;
      const after = theirsT.get(p) ?? null;
      const cls = sigdiff(before, after, p);
      if (w.upper.has(p)) {
        const ours = w.upper.get(p) ?? null;
        const merged = before !== null && after !== null && ours !== null ? unionMerge(before, ours, after) : null;
        if (merged !== null) {
          w.upper.set(p, merged);
          notices.push({ path: p, kind: 'write-write', severity: cls.severity, reason: cls.reason, mergeResult: 'merged', mergeMethod: 'union' });
        } else {
          w.upper.set(p, `<<<<<<< ours\n${ours ?? ''}\n=======\n${after ?? ''}\n>>>>>>> main\n`);
          notices.push({ path: p, kind: 'write-write', severity: 'interrupt', reason: 'conflict', mergeResult: 'conflict', mergeMethod: null });
        }
      } else if (w.reads.has(p)) {
        notices.push({ path: p, kind: 'read-write', severity: cls.severity, reason: cls.reason, mergeResult: null, mergeMethod: null });
      }
    }
    w.pin = toSha;
    for (const p of delta) w.reads.delete(p);
    return { fromSha: from, toSha, generation: 2, delta, readSet, writeSet, notices };
  }

  snapshots: { id: string; remote: string }[] = [];
  async snapshot(id: string, remote: string) {
    this.snapshots.push({ id, remote });
    return { sha: 'snap', parent: this.w(id).pin, ref: `refs/heads/overlay/${id}`, changes: this.w(id).upper.size };
  }

  async inbox() {
    return { notices: [] };
  }

  /** Integrator role. */
  async integrate(req: IntegrateRequest): Promise<IntegrateResponse> {
    if (req.expectedHeadSha !== this.git.head) return { ok: false, error: 'head-moved', actualHeadSha: this.git.head };
    const head = this.git.tree(this.git.head);
    const pin = this.git.tree(req.pinSha);
    const next = new Map(head);
    const merged: { path: string; method: string }[] = [];
    const needs: string[] = [];
    for (const c of req.changes) {
      const changedOnMain = pin.get(c.path) !== head.get(c.path);
      if (!changedOnMain) {
        if (c.content === null) next.delete(c.path);
        else next.set(c.path, c.content);
        continue;
      }
      const m = req.autoMerge.includes(c.path) && c.content !== null ? unionMerge(pin.get(c.path) ?? '', c.content, head.get(c.path) ?? '') : null;
      if (m === null) needs.push(c.path);
      else {
        next.set(c.path, m);
        merged.push({ path: c.path, method: 'union' });
      }
    }
    if (needs.length > 0) return { ok: false, error: 'needs-checkpoint', paths: needs };
    const classes: Record<string, ChangeClass> = {};
    const changedPaths = req.changes.map((c) => c.path);
    for (const p of changedPaths) classes[p] = sigdiff(head.get(p) ?? null, next.get(p) ?? null, p).class;
    const toRun = new Set(req.impactTests);
    for (const [p, tests] of Object.entries(req.impactCandidates ?? {})) {
      if (classes[p] === 'body' || classes[p] === 'signature') for (const t of tests) toRun.add(t);
    }
    if (toRun.size > 0) {
      const view = (p: string) => next.get(p);
      const files = [...toRun].map((f) => {
        const err = this.oracle(view, f);
        return { file: f, ok: err === null, failures: err ? [{ name: f, message: err }] : [] };
      });
      const failed = files.filter((f) => !f.ok).length;
      if (failed > 0) return { ok: false, error: 'impact-failed', results: { ok: false, passed: files.length - failed, failed, files, output: '', durationMs: 1 } };
    }
    const parent = this.git.head;
    this.git.head = this.git.commit(next);
    return { ok: true, sha: this.git.head, parent, changedPaths, classes, merged, impact: null, impactRan: [...toRun] };
  }
}
