import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { SeedSource } from '@livemain/core';
import { afterEach, describe, expect, it } from 'vitest';
import { ArtifactsGitHost, parsePatch, type ArtifactsCommit, type ArtifactsNamespace, type ArtifactsRepo, type ArtifactsTreeEntry } from '../src/index.js';

/** An Artifacts namespace over real git repos on disk, so trees and commits are real objects. */
class FakeArtifacts implements ArtifactsNamespace {
  readonly root = mkdtempSync(join(tmpdir(), 'lm-artifacts-'));
  readonly tokens = new Map<string, { scope: string; revoked: boolean }>();
  calls = 0;

  dir(name: string) {
    return join(this.root, `${name}.git`);
  }

  git(name: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: this.dir(name), encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'agent', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'agent', GIT_COMMITTER_EMAIL: 'a@x' } }).trimEnd();
  }

  private token(scope: string) {
    const plaintext = `art_v1_${this.tokens.size}?expires=1`;
    this.tokens.set(plaintext, { scope, revoked: false });
    return { id: plaintext, plaintext, scope: scope as 'read' | 'write', expiresAt: '2027-01-01T00:00:00Z' };
  }

  async create(name: string) {
    mkdirSync(this.dir(name));
    this.git(name, 'init', '-q', '--bare', '-b', 'main');
    return { name, defaultBranch: 'main', remote: `https://artifacts.test/ns/${name}.git`, token: this.token('write').plaintext };
  }

  async delete() {
    return true;
  }

  async get(name: string): Promise<ArtifactsRepo> {
    const git = (...a: string[]) => {
      this.calls++;
      return this.git(name, ...a);
    };
    const exists = (hash: string, type: string) => {
      try {
        return git('cat-file', '-t', hash) === type;
      } catch {
        return false;
      }
    };
    const commit = (hash: string): ArtifactsCommit => {
      const [h, tree, parents, an, ae, at, ...msg] = git('show', '-s', '--format=%H%n%T%n%P%n%an%n%ae%n%at%n%B', hash).split('\n');
      return { hash: h!, treeHash: tree!, parents: parents ? parents.split(' ') : [], author: { name: an!, email: ae! }, authoredAt: Number(at), message: msg.join('\n').trimEnd() };
    };
    return {
      createToken: async (scope = 'write') => this.token(scope),
      revokeToken: async (t) => {
        const tok = this.tokens.get(t);
        if (tok) tok.revoked = true;
        return !!tok;
      },
      info: async () => ({ remote: `https://artifacts.test/ns/${name}.git`, defaultBranch: 'main' }),
      readBlob: async (hash) => (exists(hash, 'blob') ? new Blob([execFileSync('git', ['cat-file', 'blob', hash], { cwd: this.dir(name) })]) : null),
      readTree: async (hash): Promise<ArtifactsTreeEntry[] | null> => {
        if (!exists(hash, 'tree')) return null;
        return git('ls-tree', hash)
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [meta, entryName] = line.split('\t');
            const [mode, type, h] = meta!.split(' ');
            return { name: entryName!, mode: mode!, hash: h!, type: type === 'tree' ? 'tree' : mode === '100755' ? 'exec' : 'blob' };
          });
      },
      readCommit: async (hash) => (exists(hash, 'commit') ? commit(hash) : null),
      readFile: async ({ ref, path }) => {
        try {
          return new Blob([execFileSync('git', ['show', `${ref}:${path}`], { cwd: this.dir(name), stdio: ['ignore', 'pipe', 'ignore'] })]);
        } catch {
          return null;
        }
      },
      log: async ({ ref = 'HEAD', limit = 50 } = {}) => {
        try {
          return git('rev-list', '--first-parent', `--max-count=${limit}`, ref).split('\n').filter(Boolean).map(commit);
        } catch {
          return [];
        }
      },
      fork: async () => {
        throw new Error('not used');
      },
      [Symbol.dispose]: () => undefined,
    };
  }

  /** Commit files onto main of a repo (null deletes), as a workcell push would. */
  commit(name: string, files: Record<string, string | Buffer | null>, message: string): string {
    const work = mkdtempSync(join(tmpdir(), 'lm-work-'));
    const head = (() => {
      try {
        return this.git(name, 'rev-parse', '--verify', '-q', 'refs/heads/main');
      } catch {
        return null;
      }
    })();
    const run = (...a: string[]) => execFileSync('git', a, { cwd: work, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'agent', GIT_AUTHOR_EMAIL: 'a@x', GIT_COMMITTER_NAME: 'agent', GIT_COMMITTER_EMAIL: 'a@x' } }).trimEnd();
    if (head) run('clone', '-q', this.dir(name), '.');
    else run('init', '-q', '-b', 'main');
    for (const [p, content] of Object.entries(files)) {
      const full = join(work, p);
      if (content === null) rmSync(full);
      else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
      }
    }
    run('add', '-A');
    run('commit', '-q', '-m', message);
    run('push', '-q', this.dir(name), 'HEAD:refs/heads/main');
    const sha = run('rev-parse', 'HEAD');
    rmSync(work, { recursive: true, force: true });
    return sha;
  }
}

// Real git subprocesses: slow under parallel test load.
describe('ArtifactsGitHost', { timeout: 30_000 }, () => {
  let fake: FakeArtifacts;
  const seeds: { remote: string; source: SeedSource }[] = [];
  afterEach(() => rmSync(fake.root, { recursive: true, force: true }));

  async function setup() {
    fake = new FakeArtifacts();
    seeds.length = 0;
    const host = new ArtifactsGitHost(fake, {
      seed: async (remote, source, message) => {
        seeds.push({ remote, source });
        const name = /\/ns\/(.+)\.git$/.exec(new URL(remote).pathname)![1]!;
        if (!('files' in source)) throw new Error('only files in this fake');
        return { sha: fake.commit(name, source.files, message) };
      },
    });
    const created = await host.create('demo.app');
    const v1 = await host.initialCommit('demo.app', { 'README.md': '# app\n', 'src/a.ts': 'export const a = 1;\n', 'src/lib/b.ts': 'export const b = 2;\n' }, 'Initial commit');
    return { host, created, v1 };
  }

  it('creates repos with a long-lived write remote and seeds through the integrator', async () => {
    const { created, v1 } = await setup();
    expect(created.cloneUrl).toBe('https://artifacts.test/ns/demo.app.git');
    const remote = new URL(created.remote);
    expect(remote.username).toBe('x');
    expect(decodeURIComponent(remote.password)).toMatch(/^art_v1_/);
    // creation's own token is revoked, the seed push token is revoked after use
    expect([...fake.tokens.values()].filter((t) => !t.revoked).map((t) => t.scope)).toEqual(['write']);
    expect(seeds[0]!.remote).not.toBe(created.remote);
    expect(fake.git('demo.app', 'rev-parse', 'main')).toBe(v1);
  });

  it('lists the full tree, reads files and logs history', async () => {
    const { host, v1 } = await setup();
    const v2 = fake.commit('demo.app', { 'src/a.ts': 'export const a = 10;\n' }, 'change a\n\nbody');
    expect((await host.tree('demo.app', 'main')).map((e) => `${e.type}:${e.path}`)).toEqual(['file:README.md', 'dir:src', 'file:src/a.ts', 'dir:src/lib', 'file:src/lib/b.ts']);
    expect(await host.file('demo.app', v1, 'src/a.ts')).toBe('export const a = 1;\n');
    expect(await host.file('demo.app', 'main', 'src/a.ts')).toBe('export const a = 10;\n');
    expect(await host.file('demo.app', 'main', 'nope.ts')).toBeNull();

    const log = await host.log('demo.app', 'main');
    expect(log.map((c) => [c.sha, c.subject])).toEqual([
      [v2, 'change a'],
      [v1, 'Initial commit'],
    ]);
    expect(log[0]!.at).toBeGreaterThan(1e12); // milliseconds, like the git server
    expect((await host.log('demo.app', 'main', { path: 'src/lib/b.ts' })).map((c) => c.sha)).toEqual([v1]);
    expect((await host.log('demo.app', 'main', { path: 'src/a.ts', max: 1 })).map((c) => c.sha)).toEqual([v2]);
  });

  it('computes git-style diffs from trees, descending only into changed subtrees', async () => {
    const { host, v1 } = await setup();
    const v2 = fake.commit('demo.app', { 'src/a.ts': 'export const a = 10;\n', 'src/new.ts': 'new\n', 'README.md': null, 'logo.png': Buffer.from([0x89, 0x50, 0, 1]) }, 'mixed');
    const patches = parsePatch(await host.diff('demo.app', v2));
    expect(patches.map((p) => [p.path, p.status, p.added, p.removed, !!p.binary])).toEqual([
      ['README.md', 'deleted', 0, 1, false],
      ['logo.png', 'added', 0, 0, true],
      ['src/a.ts', 'modified', 1, 1, false],
      ['src/new.ts', 'added', 1, 0, false],
    ]);
    expect(patches[2]!.hunks[0]!.lines.map((l) => `${l.kind}:${l.text}`)).toEqual(['del:export const a = 1;', 'add:export const a = 10;']);

    // the untouched src/lib subtree is never read
    fake.calls = 0;
    const host2 = new ArtifactsGitHost(fake, { seed: async () => ({ sha: '' }) });
    await host2.diff('demo.app', v2, v1);
    const reads = fake.calls;
    expect(reads).toBeLessThan(20);
    // trees and commits are cached: a second diff only reads blobs again
    fake.calls = 0;
    await host2.diff('demo.app', v2, v1);
    expect(fake.calls).toBeLessThan(reads);

    // a root commit diffs against the empty tree
    expect(parsePatch(await host.diff('demo.app', v1)).map((p) => [p.path, p.status])).toEqual([
      ['README.md', 'added'],
      ['src/a.ts', 'added'],
      ['src/lib/b.ts', 'added'],
    ]);
  });

  it('hands out read-only clone URLs', async () => {
    const { host } = await setup();
    const access = await host.cloneAccess('demo.app');
    const url = new URL(access.url);
    expect(url.host).toBe('artifacts.test');
    expect(fake.tokens.get(decodeURIComponent(url.password))?.scope).toBe('read');
  });

  it('waits out a repo that is still being created or imported', async () => {
    fake = new FakeArtifacts();
    await fake.create('slow');
    let pending = 2;
    const ns: ArtifactsNamespace = {
      ...fake,
      create: fake.create.bind(fake),
      delete: fake.delete.bind(fake),
      get: async (name) => {
        if (pending-- > 0) throw Object.assign(new Error('importing'), { code: 'IMPORT_IN_PROGRESS' });
        return fake.get(name);
      },
    };
    const host = new ArtifactsGitHost(ns, { seed: async () => ({ sha: '' }) }, async () => undefined);
    expect(await host.file('slow', 'main', 'x')).toBeNull();
    expect(pending).toBe(-1);
  });
});
