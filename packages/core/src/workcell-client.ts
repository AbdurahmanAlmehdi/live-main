import type {
  CheckpointResult,
  FileChange,
  IntegrateRequest,
  IntegrateResponse,
  OverlayInfo,
  TestRunResult,
  WorkcellNotice,
} from '@livemain/protocol';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class WorkcellError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export interface CreateWorkspaceRequest {
  id: string;
  kind: 'livefs' | 'clone';
  remote: string;
  sha: string;
  branch?: string;
}

export interface WorkspaceInfo {
  id: string;
  kind?: 'livefs' | 'clone';
  path: string;
  sha: string;
  generation: number;
}

export type GitOp =
  | 'status'
  | 'commit'
  | 'fetch'
  | 'rebase'
  | 'rebase-continue'
  | 'rebase-abort'
  | 'merge'
  | 'push'
  | 'head'
  | 'diff';

export interface GitResult {
  ok: boolean;
  output?: string;
  conflicts?: string[];
  rejected?: boolean;
  sha?: string;
  branch?: string;
  clean?: boolean;
  changed?: string[];
  diff?: string;
}

/** Where the integrator's first commit of main comes from. */
export type SeedSource = { dir: string } | { files: Record<string, string> } | { url: string };

/**
 * Typed client for the workcell HTTP contract (docs/workcell-api.md).
 * `fetchImpl` is global fetch locally, or a Container stub's fetch on Cloudflare.
 */
export class WorkcellClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {}

  private async call<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = { error: 'bad-json', message: text.slice(0, 500) };
    }
    if (!res.ok && !okStatuses.includes(res.status)) {
      const err = (parsed ?? {}) as { error?: string; message?: string };
      throw new WorkcellError(res.status, err.error ?? 'http-error', err.message ?? `${method} ${path} → ${res.status}`, parsed);
    }
    return parsed as T;
  }

  health() {
    return this.call<{ ok: boolean; role: string; workspaces: number; mergiraf: boolean }>('GET', '/health');
  }

  createWorkspace(req: CreateWorkspaceRequest) {
    return this.call<WorkspaceInfo>('POST', '/workspaces', req);
  }

  deleteWorkspace(id: string) {
    return this.call<{ ok: boolean }>('DELETE', `/workspaces/${enc(id)}`);
  }

  read(id: string, path: string, offset?: number, limit?: number) {
    return this.call<{ content: string; totalLines: number }>('POST', `/workspaces/${enc(id)}/fs/read`, { path, offset, limit });
  }

  write(id: string, path: string, content: string) {
    return this.call<{ ok: boolean }>('POST', `/workspaces/${enc(id)}/fs/write`, { path, content });
  }

  edit(id: string, path: string, oldString: string, newString: string, replaceAll = false) {
    return this.call<{ ok: boolean; replacements: number }>('POST', `/workspaces/${enc(id)}/fs/edit`, {
      path,
      oldString,
      newString,
      replaceAll,
    });
  }

  remove(id: string, path: string) {
    return this.call<{ ok: boolean }>('POST', `/workspaces/${enc(id)}/fs/delete`, { path });
  }

  /** Discard this workspace's changes to one file (back to the pinned base / HEAD). */
  revert(id: string, path: string) {
    return this.call<{ ok: boolean }>('POST', `/workspaces/${enc(id)}/fs/revert`, { path });
  }

  list(id: string, path = '', recursive = false) {
    return this.call<{ entries: { path: string; type: 'file' | 'dir' }[] }>('POST', `/workspaces/${enc(id)}/fs/list`, {
      path,
      recursive,
    });
  }

  grep(id: string, pattern: string, opts: { path?: string; glob?: string; maxResults?: number } = {}) {
    return this.call<{ matches: { path: string; line: number; text: string }[]; truncated: boolean }>(
      'POST',
      `/workspaces/${enc(id)}/fs/grep`,
      { pattern, ...opts },
    );
  }

  test(id: string, files?: string[], timeoutMs = 120_000) {
    return this.call<TestRunResult>('POST', `/workspaces/${enc(id)}/test`, { files, timeoutMs });
  }

  checkpoint(id: string, toSha: string) {
    return this.call<CheckpointResult>('POST', `/workspaces/${enc(id)}/checkpoint`, { toSha });
  }

  overlay(id: string) {
    return this.call<OverlayInfo>('GET', `/workspaces/${enc(id)}/overlay`);
  }

  /** Publish the overlay as a commit on its base, fast-forwarding `ref` (default refs/heads/overlay/<id>). */
  snapshot(id: string, remote: string, ref?: string, message?: string) {
    return this.call<{ sha: string; parent: string; ref: string; changes: number }>('POST', `/workspaces/${enc(id)}/snapshot`, {
      remote,
      ref,
      message,
    });
  }

  inbox(id: string) {
    return this.call<{ notices: WorkcellNotice[] }>('GET', `/workspaces/${enc(id)}/inbox`);
  }

  pushInbox(id: string, notices: unknown[]) {
    return this.call<{ ok: boolean }>('POST', `/workspaces/${enc(id)}/inbox`, { notices });
  }

  git(id: string, op: GitOp, args: { message?: string; ref?: string; remoteRef?: string; force?: boolean } = {}) {
    return this.call<GitResult>('POST', `/workspaces/${enc(id)}/git`, { op, ...args }, [409]);
  }

  /** Integrator role: returns typed failures for 409s instead of throwing. */
  integrate(req: IntegrateRequest): Promise<IntegrateResponse> {
    return this.call<IntegrateResponse>('POST', '/integrate', req, [409]).then((r) =>
      (r as { ok?: boolean }).ok === undefined ? { ...(r as object), ok: false } as IntegrateResponse : r,
    );
  }

  /** Rejects when the runner produced no report (crash or timeout), so callers retry instead of recording 0/0. */
  async ci(remote: string, sha: string, files?: string[], timeoutMs = 600_000) {
    const result = await this.call<TestRunResult & { sha: string }>('POST', '/ci', { remote, sha, files, timeoutMs });
    if (!result.files?.length) throw new Error(`ci ${sha.slice(0, 8)}: no test report\n${result.output.slice(-1000)}`);
    return result;
  }

  /** Integrator role: create main on an empty remote from a directory in the image, inline files or a git URL. */
  seed(remote: string, source: string | SeedSource, message: string) {
    return this.call<{ sha: string }>('POST', '/seed', { remote, ...(typeof source === 'string' ? { dir: source } : source), message });
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

export type { FileChange };
