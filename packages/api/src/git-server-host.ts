import type { GitHost } from './ports.js';

/**
 * GitHost over the workcell image's git server (`workcell serve-git`): the local stand-in for
 * Artifacts, and the fallback for a Worker without an Artifacts binding.
 */
export class GitServerHost implements GitHost {
  constructor(
    /** as reachable from this process, e.g. http://127.0.0.1:18090 */
    private readonly base: string,
    private readonly fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = (i, init) => fetch(i, init),
    /** base of the clone URLs people use (default: `base`) */
    private readonly publicBase: string = base.replace('127.0.0.1', 'localhost'),
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw Object.assign(new Error(err.message ?? `${method} ${path}: ${res.status}`), { status: res.status });
    }
    return (await res.json()) as T;
  }

  async create(name: string) {
    const r = await this.call<{ remote: string }>('POST', '/repos', { name });
    return { remote: r.remote, cloneUrl: `${this.publicBase}/${name}.git` };
  }

  async initialCommit(name: string, files: Record<string, string>, message: string) {
    return (await this.call<{ sha: string }>('POST', `/repos/${name}/init`, { files, message })).sha;
  }

  async importUrl(name: string, url: string) {
    return (await this.call<{ sha: string }>('POST', `/repos/${name}/import`, { url })).sha;
  }

  async tree(name: string, ref: string) {
    return (await this.call<{ entries: { path: string; type: 'file' | 'dir'; size: number | null }[] }>('GET', `/repos/${name}/tree?ref=${encodeURIComponent(ref)}`)).entries;
  }

  async file(name: string, ref: string, path: string) {
    const res = await this.fetchImpl(`${this.base}/repos/${name}/file?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`);
    return res.ok ? res.text() : null;
  }

  async log(name: string, ref: string, opts: { path?: string; max?: number } = {}) {
    const q = new URLSearchParams({ ref, ...(opts.path ? { path: opts.path } : {}), ...(opts.max ? { max: String(opts.max) } : {}) });
    return (await this.call<{ commits: Awaited<ReturnType<GitHost['log']>> }>('GET', `/repos/${name}/log?${q}`)).commits;
  }

  smartHttp(name: string, _access: 'read' | 'write', path: string, init?: RequestInit) {
    return this.fetchImpl(`${this.base}/${name}.git${path}`, init);
  }

  async diff(name: string, to: string, from?: string) {
    const q = new URLSearchParams({ to, ...(from ? { from } : {}) });
    return (await this.call<{ patch: string }>('GET', `/repos/${name}/diff?${q}`)).patch;
  }
}

