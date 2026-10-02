import type {
  AgentId,
  CheckpointBeginResponse,
  CheckpointCommitRequest,
  ExternalLandingRequest,
  HeadResponse,
  Notice,
  OverlayState,
  PromoteRequest,
  PromoteResponse,
  RegisterRequest,
  RegisterResponse,
  RunEvent,
  TestRunResult,
  Version,
  VersionRecord,
} from '@livemain/protocol';
import { Coordinator, CoordinatorError } from './coordinator.js';
import type { FetchLike } from './workcell-client.js';

/**
 * Coordinator HTTP API, shared by the Durable Object and the local Node server.
 * All routes live under /api. Bodies and responses are JSON.
 */
export async function handleCoordinatorRequest(coord: Coordinator, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  try {
    const body = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
    switch (route) {
      case 'POST /api/init':
        return json(coord.init(String(body.seedSha)));
      case 'GET /api/head':
        return json(coord.head());
      case 'POST /api/register':
        return json(coord.register(body as unknown as RegisterRequest));
      case 'POST /api/checkpoint/begin':
        return json(coord.checkpointBegin(String(body.agentId)));
      case 'POST /api/checkpoint/commit':
        return json({ notices: coord.checkpointCommit(body as unknown as CheckpointCommitRequest) });
      case 'POST /api/promote':
        return json(await coord.promote(body as unknown as PromoteRequest));
      case 'POST /api/sets':
        coord.reportSets(String(body.agentId), body.readSet as string[], body.writeSet as string[]);
        return json({ ok: true });
      case 'POST /api/finish':
        coord.finish(String(body.agentId), body.outcome as 'landed' | 'failed' | 'gave-up');
        return json({ ok: true });
      case 'POST /api/external-landing':
        return json({ version: coord.recordExternalLanding(body as unknown as ExternalLandingRequest) });
      case 'POST /api/ci':
        coord.recordCi(Number(body.version), String(body.sha), body.result as TestRunResult);
        return json({ ok: true });
      case 'POST /api/emit':
        return json({ seq: coord.emit(body.event as RunEvent) });
      case 'GET /api/notices':
        return json({ notices: coord.noticesFor(url.searchParams.get('agent') ?? '', Number(url.searchParams.get('after') ?? 0)) });
      case 'GET /api/events':
        return json({ events: coord.events(Number(url.searchParams.get('after') ?? 0), Number(url.searchParams.get('limit') ?? 1000)) });
      case 'GET /api/versions':
        return json({ versions: coord.versions(Number(url.searchParams.get('after') ?? 0), Number(url.searchParams.get('limit') ?? 200)) });
      case 'GET /api/overlays':
        return json({ overlays: coord.overlays((url.searchParams.get('status') as OverlayState['status'] | 'all' | null) ?? 'active') });
      case 'GET /api/overlay':
        return json(coord.overlay(url.searchParams.get('agent') ?? ''));
      case 'GET /api/delta':
        return json({ delta: coord.delta(Number(url.searchParams.get('from')), Number(url.searchParams.get('to'))) });
      case 'GET /api/state':
        return json(coord.stats());
      default:
        return json({ error: 'not-found', message: route }, 404);
    }
  } catch (err) {
    if (err instanceof CoordinatorError) {
      const status = err.code === 'unknown-agent' ? 404 : err.code === 'not-initialized' ? 409 : 400;
      return json({ error: err.code, message: err.message }, status);
    }
    return json({ error: 'internal', message: err instanceof Error ? err.message : String(err) }, 500);
  }
}

export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

/** The coordinator API as seen by agents, strategies and the bench runner. */
export interface CoordinatorApi {
  init(seedSha: string): Promise<HeadResponse>;
  head(): Promise<HeadResponse>;
  register(req: RegisterRequest): Promise<RegisterResponse>;
  checkpointBegin(agentId: AgentId): Promise<CheckpointBeginResponse>;
  checkpointCommit(req: CheckpointCommitRequest): Promise<Notice[]>;
  promote(req: PromoteRequest): Promise<PromoteResponse>;
  reportSets(agentId: AgentId, readSet: string[], writeSet: string[]): Promise<void>;
  finish(agentId: AgentId, outcome: 'landed' | 'failed' | 'gave-up'): Promise<void>;
  recordExternalLanding(req: ExternalLandingRequest): Promise<Version>;
  recordCi(version: Version, sha: string, result: Pick<TestRunResult, 'passed' | 'failed' | 'files'>): Promise<void>;
  emit(event: RunEvent): Promise<void>;
  notices(agentId: AgentId, afterId?: number): Promise<Notice[]>;
  events(afterSeq?: number, limit?: number): Promise<{ seq: number; event: RunEvent }[]>;
  versions(after?: number, limit?: number): Promise<VersionRecord[]>;
}

export class HttpCoordinatorClient implements CoordinatorApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
  ) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = (await res.json()) as T & { error?: string; message?: string };
    if (!res.ok) throw new Error(`coordinator ${method} ${path}: ${parsed.error ?? res.status} ${parsed.message ?? ''}`.trim());
    return parsed;
  }

  init(seedSha: string) {
    return this.call<HeadResponse>('POST', '/api/init', { seedSha });
  }
  head() {
    return this.call<HeadResponse>('GET', '/api/head');
  }
  register(req: RegisterRequest) {
    return this.call<RegisterResponse>('POST', '/api/register', req);
  }
  checkpointBegin(agentId: AgentId) {
    return this.call<CheckpointBeginResponse>('POST', '/api/checkpoint/begin', { agentId });
  }
  async checkpointCommit(req: CheckpointCommitRequest) {
    return (await this.call<{ notices: Notice[] }>('POST', '/api/checkpoint/commit', req)).notices;
  }
  promote(req: PromoteRequest) {
    return this.call<PromoteResponse>('POST', '/api/promote', req);
  }
  async reportSets(agentId: AgentId, readSet: string[], writeSet: string[]) {
    await this.call('POST', '/api/sets', { agentId, readSet, writeSet });
  }
  async finish(agentId: AgentId, outcome: 'landed' | 'failed' | 'gave-up') {
    await this.call('POST', '/api/finish', { agentId, outcome });
  }
  async recordExternalLanding(req: ExternalLandingRequest) {
    return (await this.call<{ version: Version }>('POST', '/api/external-landing', req)).version;
  }
  async recordCi(version: Version, sha: string, result: Pick<TestRunResult, 'passed' | 'failed' | 'files'>) {
    await this.call('POST', '/api/ci', { version, sha, result });
  }
  async emit(event: RunEvent) {
    await this.call('POST', '/api/emit', { event });
  }
  async notices(agentId: AgentId, afterId = 0) {
    return (await this.call<{ notices: Notice[] }>('GET', `/api/notices?agent=${encodeURIComponent(agentId)}&after=${afterId}`)).notices;
  }
  async events(afterSeq = 0, limit = 1000) {
    return (await this.call<{ events: { seq: number; event: RunEvent }[] }>('GET', `/api/events?after=${afterSeq}&limit=${limit}`)).events;
  }
  async versions(after = 0, limit = 200) {
    return (await this.call<{ versions: VersionRecord[] }>('GET', `/api/versions?after=${after}&limit=${limit}`)).versions;
  }
}

/** In-process adapter (local runs and tests): same interface, no HTTP. */
export class LocalCoordinatorClient implements CoordinatorApi {
  constructor(private readonly coord: Coordinator) {}
  async init(seedSha: string) {
    return this.coord.init(seedSha);
  }
  async head() {
    return this.coord.head();
  }
  async register(req: RegisterRequest) {
    return this.coord.register(req);
  }
  async checkpointBegin(agentId: AgentId) {
    return this.coord.checkpointBegin(agentId);
  }
  async checkpointCommit(req: CheckpointCommitRequest) {
    return this.coord.checkpointCommit(req);
  }
  promote(req: PromoteRequest) {
    return this.coord.promote(req);
  }
  async reportSets(agentId: AgentId, readSet: string[], writeSet: string[]) {
    this.coord.reportSets(agentId, readSet, writeSet);
  }
  async finish(agentId: AgentId, outcome: 'landed' | 'failed' | 'gave-up') {
    this.coord.finish(agentId, outcome);
  }
  async recordExternalLanding(req: ExternalLandingRequest) {
    return this.coord.recordExternalLanding(req);
  }
  async recordCi(version: Version, sha: string, result: Pick<TestRunResult, 'passed' | 'failed' | 'files'>) {
    this.coord.recordCi(version, sha, result);
  }
  async emit(event: RunEvent) {
    this.coord.emit(event);
  }
  async notices(agentId: AgentId, afterId = 0) {
    return this.coord.noticesFor(agentId, afterId);
  }
  async events(afterSeq = 0, limit = 1000) {
    return this.coord.events(afterSeq, limit);
  }
  async versions(after = 0, limit = 200) {
    return this.coord.versions(after, limit);
  }
}
