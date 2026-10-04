import { createTwoFilesPatch } from 'diff';
import { nodeSqlStore } from '@livemain/core/node';
import type { Solution, Task } from '@livemain/protocol';
import { FakeGit, FakeWorkcell } from '../../agent/test/fake-world.js';
import { LocalApi, webCryptoVault, newMasterKey, type GitHost, type Platform, type Template } from '../src/index.js';

export const MARKER = '  // functions (keep last)';

/** GitHost over the in-memory git the fake workcell integrates into (one repo). */
class FakeGitHost implements GitHost {
  constructor(private readonly git: FakeGit) {}
  async create(name: string) {
    return { remote: 'fake://main', cloneUrl: `http://localhost/${name}.git` };
  }
  async initialCommit(_name: string, files: Record<string, string>) {
    this.git.head = this.git.commit(new Map(Object.entries(files)));
    return this.git.head;
  }
  async importUrl(): Promise<string> {
    throw new Error('not supported');
  }
  private sha(ref: string) {
    return ref === 'main' ? this.git.head : ref;
  }
  async tree(_name: string, ref: string) {
    const files = [...this.git.tree(this.sha(ref)).keys()];
    const dirs = new Set(files.flatMap((f) => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))));
    return [...[...dirs].map((d) => ({ path: d, type: 'dir' as const, size: null })), ...files.map((f) => ({ path: f, type: 'file' as const, size: 1 }))];
  }
  async file(_name: string, ref: string, path: string) {
    return this.git.tree(this.sha(ref)).get(path) ?? null;
  }
  async log() {
    return [];
  }
  /** commits are c1, c2, … in order, so a commit's parent is the previous number */
  async diff(_name: string, to: string, from?: string) {
    const parent = from ?? `c${Number(to.slice(1)) - 1}`;
    const a = this.git.tree(parent);
    const b = this.git.tree(to);
    return this.git
      .delta(parent, to)
      .map((p) => `diff --git a/${p} b/${p}\n${createTwoFilesPatch(a.has(p) ? `a/${p}` : '/dev/null', b.has(p) ? `b/${p}` : '/dev/null', a.get(p) ?? '', b.get(p) ?? '').split('\n').slice(1).join('\n')}`)
      .join('\n');
  }
}

const fn = (name: string): Solution => ({
  taskId: `fn-${name}`,
  variants: [
    {
      requires: [],
      ops: [
        { op: 'write', path: `src/${name}.ts`, content: `export default 1;\n` },
        { op: 'insertBefore', path: 'src/registry.ts', anchor: MARKER, text: `  ${name}: () => import('./${name}'),\n` },
      ],
    },
  ],
});

const task = (name: string, dependsOn: string[] = []): Task => ({ id: `fn-${name}`, kind: 'leaf', title: `Implement ${name}`, prompt: name, tests: [`tests/${name}.test.ts`], dependsOn });

export function world(names = ['SUM', 'AVG', 'MAX']) {
  const git = new FakeGit({});
  const wc = new FakeWorkcell(git);
  const solutions = new Map(names.map((n) => [`fn-${n}`, fn(n)]));
  const template: Template = {
    id: 'demo',
    name: 'Demo engine',
    description: 'a tiny formula engine',
    seed: { kind: 'files', files: { 'README.md': '# demo\n', 'src/registry.ts': `export const registry = {\n${MARKER}\n};\n` } },
    tasks: names.map((n, i) => task(n, i === 1 ? [`fn-${names[0]}`] : [])),
    solution: (id) => solutions.get(id),
  };
  const dbs = new Map<string, ReturnType<typeof nodeSqlStore>>();
  const platform: Platform = {
    git: new FakeGitHost(git),
    sql: (name) => {
      let db = dbs.get(name);
      if (!db) dbs.set(name, (db = nodeSqlStore()));
      return db;
    },
    integrator: wc.asClient(),
    workcells: [{ name: 'wc0', client: wc.asClient() }],
    vault: webCryptoVault(newMasterKey()),
    templates: [template],
    session: { user: { login: 'lina', name: 'Lina Haddad' }, org: 'acme', mode: 'local' },
  };
  const api = new LocalApi(platform, { thinkMs: 0 });
  return { git, wc, api, platform, dbs };
}

export async function until<T>(fn: () => T | undefined | false | Promise<T | undefined | false>, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}
