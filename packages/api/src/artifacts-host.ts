import type { SeedSource } from '@livemain/core';
import { unifiedPatch } from './diff.js';
import { notFound } from './errors.js';
import type { GitHost } from './ports.js';

/**
 * The Cloudflare Artifacts Workers binding, as far as Live Main uses it (`wrangler types`
 * generates the full shape). Structural, so the host runs against a fake in tests.
 */
export interface ArtifactsNamespace {
  create(name: string, opts?: { readOnly?: boolean; description?: string; setDefaultBranch?: string }): Promise<ArtifactsCreateRepoResult>;
  get(name: string): Promise<ArtifactsRepo>;
  delete(name: string): Promise<boolean>;
}

export interface ArtifactsCreateRepoResult {
  name: string;
  defaultBranch: string;
  /** HTTPS git remote, without credentials */
  remote: string;
  /** initial access token (plaintext, returned once) */
  token: string;
}

export interface ArtifactsTreeEntry {
  name: string;
  mode: string;
  hash: string;
  type: 'tree' | 'blob' | 'symlink' | 'gitlink' | 'exec';
}

export interface ArtifactsCommit {
  hash: string;
  treeHash: string;
  message: string;
  author: { name: string; email: string };
  parents: string[];
  /** Unix seconds */
  authoredAt: number;
}

/** A repository capability (an RPC stub: dispose it when done). */
export interface ArtifactsRepo extends Disposable {
  createToken(scope?: 'write' | 'read', ttl?: number): Promise<{ id: string; plaintext: string; scope: 'read' | 'write'; expiresAt: string }>;
  revokeToken(tokenOrId: string): Promise<boolean>;
  info(): Promise<{ remote: string; defaultBranch: string }>;
  readBlob(hash: string): Promise<Blob | null>;
  readTree(hash: string): Promise<ArtifactsTreeEntry[] | null>;
  readCommit(hash: string): Promise<ArtifactsCommit | null>;
  readFile(args: { ref: string; path: string }): Promise<Blob | null>;
  log(opts?: { ref?: string; limit?: number; offset?: number }): Promise<ArtifactsCommit[]>;
  fork(name: string, opts?: { description?: string; readOnly?: boolean; defaultBranchOnly?: boolean }): Promise<ArtifactsCreateRepoResult>;
}

/** Git remote URL carrying a repo-scoped token (git decodes the percent-encoded password). */
export function authedRemote(remote: string, token: string): string {
  const url = new URL(remote);
  url.username = 'x';
  url.password = token;
  return url.toString();
}

/** The integrator container: Artifacts has no commit creation, so first commits are pushed. */
export interface Seeder {
  seed(remote: string, source: SeedSource, message: string): Promise<{ sha: string }>;
}

const YEAR = 365 * 24 * 3600;
/** Commits scanned when filtering history by path (Artifacts' log has no path filter). */
const PATH_SCAN = 200;
const CACHE_MAX = 5000;
const SHA = /^[0-9a-f]{40}$/;
const IN_PROGRESS = new Set(['CREATE_IN_PROGRESS', 'IMPORT_IN_PROGRESS', 'FORK_IN_PROGRESS']);

type Change = { path: string; before: string | null; after: string | null };

/**
 * GitHost on Cloudflare Artifacts. Repos, history, trees and blobs come from the binding;
 * diffs are computed here from two trees (unchanged subtrees share a hash and are skipped).
 * Trees and commits are content-addressed, so they are cached for the life of the instance.
 *
 * Workcells and the integrator get a remote with a write token valid for a year; people clone
 * with short-lived read tokens (`cloneAccess`).
 */
export class ArtifactsGitHost implements GitHost {
  private readonly trees = new Map<string, ArtifactsTreeEntry[]>();
  private readonly commits = new Map<string, ArtifactsCommit>();
  private readonly tokens = new Map<string, { remote: string; token: string; expires: number }>();

  constructor(
    private readonly ns: ArtifactsNamespace,
    private readonly seeder: Seeder,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async create(name: string) {
    const created = await this.ns.create(name, { setDefaultBranch: 'main' });
    using repo = await this.open(name);
    const token = await repo.createToken('write', YEAR);
    await repo.revokeToken(created.token).catch(() => false);
    return { remote: authedRemote(created.remote, token.plaintext), cloneUrl: created.remote };
  }

  initialCommit(name: string, files: Record<string, string>, message: string) {
    return this.seed(name, { files }, message);
  }

  importUrl(name: string, url: string) {
    return this.seed(name, { url }, `Imported from ${url}`);
  }

  /** A read token for people: `git clone <url>` works for `ttl` seconds. */
  async cloneAccess(name: string, ttl = 3600) {
    using repo = await this.open(name);
    const [info, token] = await Promise.all([repo.info(), repo.createToken('read', ttl)]);
    return { url: authedRemote(info.remote, token.plaintext), expiresAt: token.expiresAt };
  }

  /** Smart HTTP straight to the Artifacts remote, with a cached repo-scoped token. */
  async smartHttp(name: string, access: 'read' | 'write', path: string, init: RequestInit = {}) {
    const { remote, token } = await this.credential(name, access);
    const headers = new Headers(init.headers);
    headers.set('authorization', `Basic ${btoa(`x:${token}`)}`);
    return fetch(`${remote}${path}`, { ...init, headers });
  }

  async tree(name: string, ref: string) {
    using repo = await this.open(name);
    const commit = await this.commitOf(repo, ref);
    const out: { path: string; type: 'file' | 'dir'; size: number | null }[] = [];
    const walk = async (hash: string, prefix: string): Promise<void> => {
      const subtrees: Promise<void>[] = [];
      for (const e of await this.readTree(repo, hash)) {
        if (e.type === 'gitlink') continue;
        const path = prefix + e.name;
        out.push({ path, type: e.type === 'tree' ? 'dir' : 'file', size: null });
        if (e.type === 'tree') subtrees.push(walk(e.hash, `${path}/`));
      }
      await Promise.all(subtrees);
    };
    await walk(commit.treeHash, '');
    return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  async file(name: string, ref: string, path: string) {
    using repo = await this.open(name);
    const blob = await repo.readFile({ ref, path });
    return blob ? blob.text() : null;
  }

  async log(name: string, ref: string, opts: { path?: string; max?: number } = {}) {
    using repo = await this.open(name);
    const max = opts.max ?? 50;
    if (!opts.path) return (await repo.log({ ref, limit: Math.min(max, 1000) })).map(commitView);
    // Keep the commits whose first parent had a different object at path.
    const commits = await repo.log({ ref, limit: PATH_SCAN });
    const out: ArtifactsCommit[] = [];
    let current = commits[0] ? await this.hashAt(repo, commits[0].treeHash, opts.path) : null;
    for (let i = 0; i < commits.length && out.length < max; i++) {
      const parentId = commits[i]!.parents[0];
      const parent = !parentId ? null : commits[i + 1]?.hash === parentId ? commits[i + 1]! : await this.readCommit(repo, parentId);
      const before = parent ? await this.hashAt(repo, parent.treeHash, opts.path) : null;
      if (current !== before) out.push(commits[i]!);
      current = before;
    }
    return out.map(commitView);
  }

  async diff(name: string, to: string, from?: string) {
    using repo = await this.open(name);
    const target = await this.commitOf(repo, to);
    const base = from ? await this.commitOf(repo, from) : target.parents[0] ? await this.readCommit(repo, target.parents[0]) : null;
    const changes = await this.diffTrees(repo, base?.treeHash ?? null, target.treeHash, '');
    changes.sort((a, b) => (a.path < b.path ? -1 : 1));
    const patches = await Promise.all(
      changes.map(async (c) => {
        const [before, after] = await Promise.all([this.blobText(repo, c.before), this.blobText(repo, c.after)]);
        if (before === BINARY || after === BINARY) return unifiedPatch(c.path, c.before && '', c.after && '', true);
        return unifiedPatch(c.path, before, after);
      }),
    );
    return patches.join('');
  }

  // ------------------------------------------------------------------ internals

  /** First commit of main, pushed by the integrator with a short-lived write token. */
  private async seed(name: string, source: SeedSource, message: string): Promise<string> {
    using repo = await this.open(name);
    const [info, token] = await Promise.all([repo.info(), repo.createToken('write', 3600)]);
    try {
      return (await this.seeder.seed(authedRemote(info.remote, token.plaintext), source, message)).sha;
    } finally {
      await repo.revokeToken(token.id).catch(() => false);
    }
  }

  /** A token for smart HTTP, minted for an hour and reused until ten minutes before it expires. */
  private async credential(name: string, access: 'read' | 'write'): Promise<{ remote: string; token: string }> {
    const key = `${name}\0${access}`;
    const hit = this.tokens.get(key);
    if (hit && hit.expires - Date.now() > 10 * 60_000) return hit;
    using repo = await this.open(name);
    const [info, token] = await Promise.all([repo.info(), repo.createToken(access, 3600)]);
    const fresh = { remote: info.remote, token: token.plaintext, expires: Date.parse(token.expiresAt) || Date.now() + 3600_000 };
    this.tokens.set(key, fresh);
    return fresh;
  }

  /** The repo capability, waiting out a create, import or fork still in progress. */
  private async open(name: string): Promise<ArtifactsRepo> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.ns.get(name);
      } catch (err) {
        if (!IN_PROGRESS.has((err as { code?: string }).code ?? '') || attempt >= 40) throw err;
        await this.sleep(Math.min(5000, 200 * 2 ** attempt));
      }
    }
  }

  private async commitOf(repo: ArtifactsRepo, ref: string): Promise<ArtifactsCommit> {
    const commit = SHA.test(ref) ? await this.readCommit(repo, ref) : (await repo.log({ ref, limit: 1 }))[0];
    if (!commit) throw notFound(`ref ${ref}`);
    return commit;
  }

  private async readCommit(repo: ArtifactsRepo, hash: string): Promise<ArtifactsCommit | null> {
    const hit = this.commits.get(hash);
    if (hit) return hit;
    const commit = await repo.readCommit(hash);
    if (commit) remember(this.commits, hash, commit);
    return commit;
  }

  private async readTree(repo: ArtifactsRepo, hash: string): Promise<ArtifactsTreeEntry[]> {
    const hit = this.trees.get(hash);
    if (hit) return hit;
    const entries = (await repo.readTree(hash)) ?? [];
    remember(this.trees, hash, entries);
    return entries;
  }

  /** The object id at path inside a tree, or null. */
  private async hashAt(repo: ArtifactsRepo, tree: string, path: string): Promise<string | null> {
    let hash: string | null = tree;
    for (const part of path.split('/')) {
      if (!hash) return null;
      hash = (await this.readTree(repo, hash)).find((e) => e.name === part)?.hash ?? null;
    }
    return hash;
  }

  /** Changed files between two trees (null = empty), descending only into subtrees that differ. */
  private async diffTrees(repo: ArtifactsRepo, a: string | null, b: string | null, prefix: string): Promise<Change[]> {
    if (a === b) return [];
    const [left, right] = await Promise.all([a ? this.readTree(repo, a) : [], b ? this.readTree(repo, b) : []]);
    const byName = (entries: ArtifactsTreeEntry[]) => new Map(entries.filter((e) => e.type !== 'gitlink').map((e) => [e.name, e]));
    const l = byName(left);
    const r = byName(right);
    const out: Promise<Change[]>[] = [];
    for (const name of new Set([...l.keys(), ...r.keys()])) {
      const x = l.get(name);
      const y = r.get(name);
      if (x?.hash === y?.hash) continue;
      const path = prefix + name;
      const xTree = x?.type === 'tree' ? x.hash : null;
      const yTree = y?.type === 'tree' ? y.hash : null;
      if (xTree || yTree) out.push(this.diffTrees(repo, xTree, yTree, `${path}/`));
      const xBlob = x && x.type !== 'tree' ? x.hash : null;
      const yBlob = y && y.type !== 'tree' ? y.hash : null;
      if (xBlob || yBlob) out.push(Promise.resolve([{ path, before: xBlob, after: yBlob }]));
    }
    return (await Promise.all(out)).flat();
  }

  private async blobText(repo: ArtifactsRepo, hash: string | null): Promise<string | typeof BINARY | null> {
    if (!hash) return null;
    try {
      const blob = await repo.readBlob(hash);
      if (!blob) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.subarray(0, 8000).includes(0)) return BINARY;
      return new TextDecoder().decode(bytes);
    } catch {
      return BINARY; // too large to buffer (MEMORY_LIMIT): shown like a binary file
    }
  }
}

const BINARY = Symbol('binary');

function remember<V>(cache: Map<string, V>, key: string, value: V): void {
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, value);
}

function commitView(c: ArtifactsCommit) {
  return { sha: c.hash, parents: c.parents, author: c.author.name, email: c.author.email, at: c.authoredAt * 1000, subject: c.message.split('\n')[0] ?? '' };
}
