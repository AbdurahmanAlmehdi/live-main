import type {
  AgentDetail,
  AgentSummary,
  ApprovalView,
  Budget,
  CloneAccess,
  CreatedGitToken,
  CreateRepoRequest,
  CreateTaskRequest,
  DispatchEstimate,
  DispatchRequest,
  FileView,
  GitToken,
  KeyInfo,
  Landing,
  LandingDetail,
  ProviderId,
  Repo,
  RepoPolicy,
  RepoEvent,
  Session,
  SetKeyRequest,
  Swarm,
  TaskStatus,
  TaskV1,
  TreeEntry,
} from '@livemain/protocol';

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  tasks: number;
  scripted: boolean;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? 'error', data?.message ?? `${method} ${path} failed (${res.status})`);
  return data as T;
}

const repo = (owner: string, name: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

/** Typed client for API v1 (packages/api/src/router.ts). */
export const api = {
  session: () => call<Session>('GET', '/session'),
  templates: () => call<TemplateInfo[]>('GET', '/templates'),

  repos: () => call<Repo[]>('GET', '/repos'),
  repo: (o: string, n: string) => call<Repo>('GET', repo(o, n)),
  createRepo: (req: CreateRepoRequest) => call<Repo>('POST', '/repos', req),
  cloneAccess: (o: string, n: string) => call<CloneAccess>('POST', `${repo(o, n)}/clone-access`),
  tree: (o: string, n: string) => call<TreeEntry[]>('GET', `${repo(o, n)}/tree`),
  policy: (o: string, n: string) => call<RepoPolicy>('GET', `${repo(o, n)}/policy`),
  setPolicy: (o: string, n: string, p: RepoPolicy) => call<RepoPolicy>('PUT', `${repo(o, n)}/policy`, p),
  approvals: (o: string, n: string) => call<ApprovalView[]>('GET', `${repo(o, n)}/approvals`),
  decide: (o: string, n: string, id: string, approve: boolean, note?: string) => call<ApprovalView>('POST', `${repo(o, n)}/approvals/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`, { note }),
  file: (o: string, n: string, path: string) => call<FileView>('GET', `${repo(o, n)}/files/${path.split('/').map(encodeURIComponent).join('/')}`),
  landings: (o: string, n: string, before?: number) => call<Landing[]>('GET', `${repo(o, n)}/landings?limit=50${before ? `&before=${before}` : ''}`),
  landing: (o: string, n: string, v: number) => call<LandingDetail>('GET', `${repo(o, n)}/landings/${v}`),

  tasks: (o: string, n: string, status?: TaskStatus) => call<TaskV1[]>('GET', `${repo(o, n)}/tasks${status ? `?status=${status}` : ''}`),
  createTask: (o: string, n: string, req: CreateTaskRequest) => call<TaskV1>('POST', `${repo(o, n)}/tasks`, req),
  cancelTask: (o: string, n: string, id: string) => call<TaskV1>('POST', `${repo(o, n)}/tasks/${encodeURIComponent(id)}/cancel`),

  swarms: (o: string, n: string) => call<Swarm[]>('GET', `${repo(o, n)}/swarms`),
  swarm: (o: string, n: string, id: string) => call<Swarm>('GET', `${repo(o, n)}/swarms/${id}`),
  estimate: (o: string, n: string, req: DispatchRequest) => call<DispatchEstimate>('POST', `${repo(o, n)}/swarms/estimate`, req),
  dispatch: (o: string, n: string, req: DispatchRequest) => call<Swarm>('POST', `${repo(o, n)}/swarms`, req),
  pause: (o: string, n: string, id: string) => call<Swarm>('POST', `${repo(o, n)}/swarms/${id}/pause`),
  resume: (o: string, n: string, id: string) => call<Swarm>('POST', `${repo(o, n)}/swarms/${id}/resume`),
  stop: (o: string, n: string, id: string) => call<Swarm>('POST', `${repo(o, n)}/swarms/${id}/stop`),
  setBudget: (o: string, n: string, id: string, budget: Partial<Budget>) => call<Swarm>('PATCH', `${repo(o, n)}/swarms/${id}/budget`, budget),

  agents: (o: string, n: string, opts: { swarm?: string; active?: boolean } = {}) =>
    call<AgentSummary[]>('GET', `${repo(o, n)}/agents?${new URLSearchParams({ ...(opts.swarm ? { swarm: opts.swarm } : {}), ...(opts.active ? { active: '1' } : {}) })}`),
  agent: (o: string, n: string, id: string) => call<AgentDetail>('GET', `${repo(o, n)}/agents/${encodeURIComponent(id)}`),
  stopAgent: (o: string, n: string, id: string) => call<AgentSummary>('POST', `${repo(o, n)}/agents/${encodeURIComponent(id)}/stop`),

  keys: () => call<KeyInfo[]>('GET', '/keys'),
  setKey: (req: SetKeyRequest) => call<KeyInfo>('PUT', '/keys', req),
  testKey: (p: ProviderId) => call<KeyInfo>('POST', `/keys/${p}/test`),
  deleteKey: (p: ProviderId) => call<{ ok: true }>('DELETE', `/keys/${p}`),

  approveDevice: (userCode: string) => call<{ ok: true }>('POST', '/device/approve', { userCode }),
  tokens: () => call<GitToken[]>('GET', '/tokens'),
  createToken: (name: string) => call<CreatedGitToken>('POST', '/tokens', { name }),
  revokeToken: (id: string) => call<{ ok: true }>('DELETE', `/tokens/${encodeURIComponent(id)}`),

  /**
   * Live repo events over a WebSocket that reconnects with backoff. `onStatus(true)` fires on
   * every (re)connect, so callers can resync what they missed while disconnected.
   */
  events(o: string, n: string, onEvent: (e: RepoEvent) => void, onStatus?: (live: boolean) => void): () => void {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      const url = new URL(`/v1${repo(o, n)}/events`, location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry = 0;
        onStatus?.(true);
      };
      ws.onmessage = (m) => onEvent(JSON.parse(String(m.data)) as RepoEvent);
      ws.onclose = () => {
        onStatus?.(false);
        if (!closed) timer = setTimeout(connect, Math.min(15_000, 500 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  },
};
