import type { CreateRepoRequest, CreateTaskRequest, DispatchRequest, ProviderId, Repo, RepoPolicy, SetKeyRequest, TaskStatus } from '@livemain/protocol';
import { ApiError } from './errors.js';
import type { V1Api } from './local.js';
import type { OrgService } from './org-service.js';
import type { RepoService } from './repo-service.js';

type Handler<T> = (svc: T, req: Request, params: string[], url: URL) => Promise<unknown> | unknown;
type Route<T> = [method: string, pattern: RegExp, handler: Handler<T>];

/**
 * The signed-in person, set by the runtime after it authenticated the request (the Worker from
 * the Cloudflare Access JWT or a git token, stripping any client-sent value). Absent locally.
 */
export const ACTOR_HEADER = 'x-livemain-actor';

export function actorOf(req: Request): string | undefined {
  return req.headers.get(ACTOR_HEADER) ?? undefined;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function body<T>(req: Request): Promise<T> {
  let v: unknown;
  try {
    v = await req.json();
  } catch {
    v = undefined;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ApiError(400, 'bad-json', 'The request body must be a JSON object.');
  return v as T;
}

/** A JSON object body that may be empty. */
async function optionalBody<T extends object>(req: Request): Promise<Partial<T>> {
  const v = (await req.json().catch(() => null)) as unknown;
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Partial<T>) : {};
}

/** An optional `{ note }` body (approve/reject). */
async function noteOf(req: Request): Promise<string | undefined> {
  const { note } = await optionalBody<{ note: unknown }>(req);
  return typeof note === 'string' ? note : undefined;
}

function num(v: string | null): number | undefined {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function compile<T>(defs: [string, string, Handler<T>][]): Route<T>[] {
  return defs.map(([m, p, h]) => [m, new RegExp(`^${p.replace(/:[a-z]+\*/g, '(.+)').replace(/:[a-z]+/g, '([^/]+)')}$`), h]);
}

async function dispatchRoute<T>(routes: Route<T>[], svc: T, req: Request, path: string, url: URL): Promise<Response | null> {
  for (const [method, re, h] of routes) {
    if (method !== req.method) continue;
    const m = re.exec(path);
    if (m) return json(await h(svc, req, m.slice(1).map((s) => decodeURIComponent(s)), url));
  }
  return null;
}

/** People clone and push through the git gateway on this host. */
function viaGateway(repo: Repo, url: URL): Repo {
  return { ...repo, cloneUrl: `${url.origin}/git/${repo.owner}/${repo.name}.git` };
}

/** Who is acting: the authenticated person, or the install's user locally. */
function person(o: OrgService, req: Request): string {
  return o.session(actorOf(req)).user.login;
}

/** Org-level routes (an OrgDO on Cloudflare). */
const ORG_ROUTES = compile<OrgService>([
  ['GET', '/v1/session', (o, req) => o.session(actorOf(req))],
  ['POST', '/v1/device/code', (o, _, __, url) => o.startDevice(url.origin)],
  ['POST', '/v1/device/token', async (o, req) => o.pollDevice(String((await optionalBody<{ deviceCode: string }>(req)).deviceCode ?? ''))],
  ['POST', '/v1/device/approve', async (o, req) => o.approveDevice(person(o, req), String((await optionalBody<{ userCode: string }>(req)).userCode ?? ''))],
  ['GET', '/v1/tokens', (o, req) => o.tokens(person(o, req))],
  ['POST', '/v1/tokens', async (o, req) => o.createToken(person(o, req), (await body<{ name: string }>(req)).name)],
  [
    'DELETE',
    '/v1/tokens/:id',
    (o, req, [id]) => {
      o.revokeToken(person(o, req), id!);
      return { ok: true };
    },
  ],
  ['GET', '/v1/templates', (o) => o.templates()],
  ['GET', '/v1/repos', async (o, _, __, url) => (await o.listRepos()).map((r) => viaGateway(r, url))],
  ['POST', '/v1/repos', async (o, req, __, url) => viaGateway(await o.createRepo(await body<CreateRepoRequest>(req)), url)],
  ['GET', '/v1/keys', (o) => o.keys()],
  ['PUT', '/v1/keys', async (o, req) => o.setKey(await body<SetKeyRequest>(req))],
  ['POST', '/v1/keys/:provider/test', (o, _, [p]) => o.testKey(p as ProviderId)],
  [
    'DELETE',
    '/v1/keys/:provider',
    (o, _, [p]) => {
      o.deleteKey(p as ProviderId);
      return { ok: true };
    },
  ],
]);

/** Repository routes, relative to /v1/repos/:owner/:name (a RepoDO on Cloudflare). */
const REPO_ROUTES = compile<RepoService>([
  ['GET', '', (r, _, __, url) => viaGateway(r.view(), url)],
  ['POST', '/clone-access', (r) => r.cloneAccess()],
  ['GET', '/tree', (r, _, __, url) => r.tree(url.searchParams.get('ref') ?? undefined)],
  ['GET', '/files/:path*', (r, _, [p], url) => r.file(p!, url.searchParams.get('ref') ?? undefined)],
  ['GET', '/landings', (r, _, __, url) => r.landings({ before: num(url.searchParams.get('before')), limit: num(url.searchParams.get('limit')) })],
  ['GET', '/landings/:version', (r, _, [v]) => r.landing(Number(v))],
  ['GET', '/tasks', (r, _, __, url) => r.tasks({ status: (url.searchParams.get('status') as TaskStatus | null) ?? undefined })],
  ['POST', '/tasks', async (r, req) => r.createTask(await body<CreateTaskRequest>(req))],
  ['POST', '/tasks/:id/cancel', (r, _, [id]) => r.cancelTask(id!)],
  ['GET', '/swarms', (r) => r.swarms()],
  ['POST', '/swarms', async (r, req) => r.dispatch(await body<DispatchRequest>(req), actorOf(req))],
  ['POST', '/swarms/estimate', async (r, req) => r.estimate(await body<DispatchRequest>(req))],
  ['GET', '/swarms/:id', (r, _, [id]) => r.swarm(id!)],
  ['POST', '/swarms/:id/pause', (r, _, [id]) => r.pause(id!)],
  ['POST', '/swarms/:id/resume', (r, _, [id]) => r.resume(id!)],
  ['POST', '/swarms/:id/stop', (r, _, [id]) => r.stop(id!)],
  ['PATCH', '/swarms/:id/budget', async (r, req, [id]) => r.setBudget(id!, await body(req))],
  ['GET', '/policy', (r) => r.policy()],
  ['PUT', '/policy', async (r, req) => r.setPolicy(await body<RepoPolicy>(req))],
  ['GET', '/approvals', (r, _, __, url) => r.approvals((url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | 'withdrawn' | null) ?? undefined)],
  ['POST', '/approvals/:id/approve', async (r, req, [id]) => r.decide(id!, true, actorOf(req), await noteOf(req))],
  ['POST', '/approvals/:id/reject', async (r, req, [id]) => r.decide(id!, false, actorOf(req), await noteOf(req))],
  ['GET', '/agents', (r, _, __, url) => r.agents({ swarmId: url.searchParams.get('swarm') ?? undefined, active: url.searchParams.get('active') === '1' })],
  ['GET', '/agents/:id', (r, _, [id]) => r.agent(id!)],
  ['POST', '/agents/:id/stop', (r, _, [id]) => r.stopAgent(id!)],
  ['POST', '/claims', async (r, req) => r.claim(actorOf(req), (await optionalBody<{ swarmId?: string }>(req)).swarmId)],
  ['POST', '/agents/:id/tools/:name', async (r, req, [id, name]) => r.agentTool(id!, actorOf(req), name!, (await optionalBody<{ input?: Record<string, unknown> }>(req)).input ?? {})],
]);

export const REPO_PATH = /^\/v1\/repos\/([^/]+)\/([^/]+)(\/.*)?$/;

/** The git remote people use: /git/:owner/:name.git/<smart-HTTP path>. */
export const GIT_PATH = /^\/git\/([^/]+)\/([^/]+?)(?:\.git)?(\/(?:info\/refs|git-upload-pack|git-receive-pack))$/;

/** HTTP Basic credentials of a git client: the password is a Live Main git token. */
export function basicPassword(req: Request): string | null {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!m) return null;
  try {
    const decoded = atob(m[1]!);
    return decoded.slice(decoded.indexOf(':') + 1) || null;
  } catch {
    return null;
  }
}

/** A Live Main token from `Authorization: Bearer lm_…` (the CLI) or HTTP Basic (git). */
export function tokenOf(req: Request): string | null {
  return /^Bearer\s+(lm_\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1] ?? basicPassword(req);
}

/**
 * The CLI's entry: /cli/v1/* is the /v1 API authenticated by a token (not a browser session);
 * /cli/device/code and /cli/device/token are the public half of the device login.
 */
export const CLI_PATH = /^\/cli(\/v1\/.*|\/device\/(?:code|token))$/;

/** The /v1 request a /cli request stands for, acting as `actor` (stripping any client-sent one). */
export function fromCli(req: Request, path: string, actor: string | null): Request {
  const url = new URL(req.url);
  url.pathname = path.startsWith('/device/') ? `/v1${path}` : path;
  const headers = new Headers(req.headers);
  headers.delete(ACTOR_HEADER);
  if (actor) headers.set(ACTOR_HEADER, actor);
  return new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body, duplex: 'half' } as RequestInit);
}

export function gitUnauthorized(message = 'Use a Live Main git token as the password (Settings → Git tokens).'): Response {
  return new Response(`${message}\n`, { status: 401, headers: { 'www-authenticate': 'Basic realm="Live Main"', 'content-type': 'text/plain' } });
}

function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) return json({ error: err.code, message: err.message }, err.status);
  return json({ error: 'internal', message: err instanceof Error ? err.message : String(err) }, 500);
}

export function notFoundRoute(req: Request, path: string): Response {
  return json({ error: 'not-found', message: `no route ${req.method} ${path}` }, 404);
}

/** Org routes only (OrgDO). Returns null when the path is not an org route. */
export async function handleOrg(org: OrgService, req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  try {
    return await dispatchRoute(ORG_ROUTES, org, req, url.pathname, url);
  } catch (err) {
    return errorResponse(err);
  }
}

/** One repository's routes (RepoDO); `rest` is the path after /v1/repos/:owner/:name. */
export async function handleRepo(repo: RepoService, req: Request, rest: string): Promise<Response> {
  const url = new URL(req.url);
  try {
    // Smart-HTTP git (the gateway); the runtime has authenticated the person and set the actor.
    if (rest.startsWith('/git/')) {
      const who = actorOf(req);
      return who ? await repo.git(req, rest.slice(4), who) : gitUnauthorized();
    }
    return (await dispatchRoute(REPO_ROUTES, repo, req, rest, url)) ?? notFoundRoute(req, url.pathname);
  } catch (err) {
    return errorResponse(err);
  }
}

/** All of /v1 and the git gateway in one process (the local runtime). Null for other paths. */
export function handleV1(api: V1Api): (req: Request) => Promise<Response | null> {
  return async (req) => {
    const url = new URL(req.url);
    const git = GIT_PATH.exec(url.pathname);
    if (git) {
      const token = basicPassword(req);
      const who = token ? await api.org.verifyToken(token) : null;
      if (!who) return gitUnauthorized();
      try {
        const repo = await api.repo(decodeURIComponent(git[1]!), decodeURIComponent(git[2]!));
        return await repo.git(req, git[3]!, who);
      } catch (err) {
        return errorResponse(err);
      }
    }
    const cli = CLI_PATH.exec(url.pathname);
    if (cli) {
      // Locally the token is optional (it names who acts); a wrong one is refused.
      const token = tokenOf(req);
      const who = token ? await api.org.verifyToken(token) : null;
      if (token && !who) return json({ error: 'unauthenticated', message: 'Unknown or revoked token. Run `lm auth login`.' }, 401);
      return handleV1(api)(fromCli(req, cli[1]!, who));
    }
    if (!url.pathname.startsWith('/v1/')) return null;
    const org = await handleOrg(api.org, req);
    if (org) return org;
    const m = REPO_PATH.exec(url.pathname);
    if (!m) return notFoundRoute(req, url.pathname);
    try {
      const repo = await api.repo(decodeURIComponent(m[1]!), decodeURIComponent(m[2]!));
      return await handleRepo(repo, req, m[3] ?? '');
    } catch (err) {
      return errorResponse(err);
    }
  };
}
