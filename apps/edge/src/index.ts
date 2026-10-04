import { json } from '@livemain/core';
import type { StrategyName } from '@livemain/protocol';
import type { Env } from './env.js';
import type { RunConfig } from './run-do.js';
import { requireAccess } from './access.js';
import { artifactsSpike } from './spike.js';
import { ACTOR_HEADER, CLI_PATH, fromCli, GIT_PATH, gitUnauthorized, REPO_PATH, tokenOf } from '@livemain/api';
import { org } from './v1/platform.js';

export { CoordinatorDO } from './coordinator-do.js';
export { OrgDO } from './v1/org-do.js';
export { RepoDO } from './v1/repo-do.js';
export { RepoAgentDO } from './v1/repo-agent-do.js';
export { Workcell } from './workcell-do.js';
export { SwarmAgentDO } from './agent-do.js';
export { RunDO } from './run-do.js';

const STRATEGIES: StrategyName[] = ['live-main', 'pr-flow', 'push-to-branch'];

/**
 * Routes:
 *   *    /v1/repos/:owner/:name/*  a repository (RepoDO); /events is its live WebSocket
 *   *    /v1/*                     the org (OrgDO): session, templates, repo list/create, keys, git tokens
 *   *    /git/:owner/:name.git/*   smart-HTTP git through Live Main (git tokens; pushes to main are promoted)
 *   *    /cli/v1/*, /cli/device/*  the lm CLI: the /v1 API with a token, and device login
 *   POST /api/runs                 start a run   { strategy, agents, workcells, tasks, mode, thinkMs, model }
 *   GET  /api/runs                 list runs
 *   GET  /api/runs/:id             run status
 *   POST /api/synth-runs           create a synthetic coordinator for tools/synth-swarm --url
 *   POST /api/spikes/artifacts     Phase 0 spike: Artifacts round trip (create, push, readFile, fork, ff-only)
 *   *    /runs/:id/api/*           the run's coordinator API (docs: packages/core/src/http.ts)
 *   GET  /runs/:id/ws              live event stream (WebSocket)
 *   *                              dashboard (static assets)
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      // git and the CLI cannot sign in through Access: /git/* and /cli/* are exempt there and
      // authenticate with Live Main tokens here.
      const git = GIT_PATH.exec(url.pathname);
      if (git) return await gitRoute(request, env, git);
      const cli = CLI_PATH.exec(url.pathname);
      if (cli) return await cliRoute(request, env, cli[1]!);
      // Static assets never reach the Worker; everything it handles is behind Access.
      const access = await requireAccess(request, env);
      if (access instanceof Response) return access;
      request = withActor(request, access.email);
      // Reference solutions are for scripted agents only (read through the ASSETS binding).
      if (url.pathname.startsWith('/bench/solutions/')) return json({ error: 'not-found' }, 404);
      if (env.LIVEMAIN_DEBUG && url.pathname.startsWith('/debug/workcell/')) {
        // /debug/workcell/<name>/<path>: talk to a workcell container directly (debug builds only).
        const [, , , name, ...rest] = url.pathname.split('/');
        const stub = env.WORKCELL.get(env.WORKCELL.idFromName(decodeURIComponent(name!)));
        const inner = new URL(request.url);
        inner.pathname = `/${rest.join('/')}`;
        return stub.fetch(new Request(inner, request));
      }
      if (url.pathname.startsWith('/v1/')) return v1Route(request, env);
      if (url.pathname === '/api/runs' && request.method === 'POST') return startRun(request, env);
      if (url.pathname === '/api/runs' && request.method === 'GET') return listRuns(env);
      if (url.pathname === '/api/spikes/artifacts' && request.method === 'POST') return artifactsSpike(env);
      if (url.pathname === '/api/synth-runs' && request.method === 'POST') {
        const runId = `synth-${Date.now().toString(36)}`;
        const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(runId));
        await stub.configure({ runId, remote: 'synthetic', synthetic: true });
        await stub.fetch(new Request('http://coordinator/api/init', { method: 'POST', body: JSON.stringify({ seedSha: 'synth-seed' }) }));
        return json({ runId, url: `${url.origin}/runs/${runId}` }, 201);
      }
      const status = /^\/api\/runs\/([^/]+)$/.exec(url.pathname);
      if (status) return json(await env.RUN.get(env.RUN.idFromName(status[1]!)).status());
      const m = /^\/runs\/([^/]+)(\/.*)$/.exec(url.pathname);
      if (m) {
        const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(decodeURIComponent(m[1]!)));
        const inner = new URL(request.url);
        inner.pathname = m[2]!;
        return stub.fetch(new Request(inner, request));
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      return json({ error: 'internal', message: err instanceof Error ? err.message : String(err) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

/** /v1/repos/:owner/:name/* → the repository's object; the rest of /v1 → the org. */
function v1Route(request: Request, env: Env): Promise<Response> {
  const repo = REPO_PATH.exec(new URL(request.url).pathname);
  if (repo) return env.REPO.get(env.REPO.idFromName(`${decodeURIComponent(repo[1]!)}.${decodeURIComponent(repo[2]!)}`)).fetch(request);
  return env.ORG.get(env.ORG.idFromName(org(env))).fetch(request);
}

/** /cli/device/* (public half of the device login) and /cli/v1/* (the API, with a token). */
async function cliRoute(request: Request, env: Env, path: string): Promise<Response> {
  if (path.startsWith('/device/')) return v1Route(fromCli(request, path, null), env);
  const token = tokenOf(request);
  const person = token ? await env.ORG.get(env.ORG.idFromName(org(env))).verifyToken(token) : null;
  if (!person) return json({ error: 'unauthenticated', message: 'Sign in with `lm auth login`.' }, 401);
  return v1Route(fromCli(request, path, person), env);
}

/** The person acting, as the API sees it: only ever set here, never taken from the client. */
function withActor(request: Request, person: string | null): Request {
  const headers = new Headers(request.headers);
  headers.delete(ACTOR_HEADER);
  if (person) headers.set(ACTOR_HEADER, person);
  return new Request(request, { headers });
}

/** /git/:owner/:name.git/* → the repo's object, as the person the git token belongs to. */
async function gitRoute(request: Request, env: Env, m: RegExpExecArray): Promise<Response> {
  const token = tokenOf(request);
  const person = token ? await env.ORG.get(env.ORG.idFromName(org(env))).verifyToken(token) : null;
  if (!person) return gitUnauthorized();
  const owner = decodeURIComponent(m[1]!);
  const name = decodeURIComponent(m[2]!);
  const inner = new URL(request.url);
  inner.pathname = `/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git${m[3]}`;
  return env.REPO.get(env.REPO.idFromName(`${owner}.${name}`)).fetch(withActor(new Request(inner, request), person));
}

async function startRun(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as Partial<RunConfig>;
  const strategy = body.strategy ?? 'live-main';
  if (!STRATEGIES.includes(strategy)) return json({ error: 'bad-request', message: `unknown strategy ${strategy}` }, 400);
  const mode = body.mode ?? 'scripted';
  if (mode === 'llm' && !env.ANTHROPIC_API_KEY) return json({ error: 'bad-request', message: 'llm mode needs the ANTHROPIC_API_KEY secret' }, 400);
  const runId = body.runId ?? `${strategy}-${Date.now().toString(36)}`;
  const config: RunConfig = {
    runId,
    strategy,
    agents: clamp(body.agents ?? 8, 1, 1000),
    workcells: clamp(body.workcells ?? 2, 1, 200),
    tasks: clamp(body.tasks ?? 40, 1, 1000),
    mode,
    thinkMs: body.thinkMs ?? 1500,
    model: body.model,
    coModel: body.coModel,
    seedDir: body.seedDir,
  };
  const res = await env.RUN.get(env.RUN.idFromName(runId)).start(config);
  await env.RUN.get(env.RUN.idFromName('__index__')).register(runId);
  return json(res, 201);
}

async function listRuns(env: Env): Promise<Response> {
  const ids = await env.RUN.get(env.RUN.idFromName('__index__')).list();
  return json({ runs: ids.map((runId) => ({ runId })) });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
