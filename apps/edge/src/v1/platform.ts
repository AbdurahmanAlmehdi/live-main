import { ArtifactsGitHost, GitServerHost, webCryptoVault, type GitHost, type KeyVault, type Template } from '@livemain/api';
import { WorkcellClient } from '@livemain/core';
import type { Session, Solution, TaskBank } from '@livemain/protocol';
import { workcellClient } from '../clients.js';
import type { Env } from '../env.js';

/**
 * How the API's ports are satisfied on Cloudflare. Workcells and the integrator are
 * Container Durable Objects, or plain HTTP servers in development (WORKCELL_URLS), which is
 * also how they would run on a normal Linux server.
 */
export function org(env: Env): string {
  return env.LIVEMAIN_ORG ?? 'demo';
}

export function session(env: Env): Session {
  const login = env.LIVEMAIN_USER ?? org(env);
  return { user: { login, name: login }, org: org(env), mode: 'hosted' };
}

export function vault(env: Env): KeyVault {
  if (!env.LIVEMAIN_MASTER_KEY) throw new Error('LIVEMAIN_MASTER_KEY is not set (wrangler secret put LIVEMAIN_MASTER_KEY)');
  return webCryptoVault(env.LIVEMAIN_MASTER_KEY);
}

/** Artifacts hosts every repository; a git server (GIT_REMOTE_BASE) stands in without the binding. */
export function gitHost(env: Env): GitHost {
  if (env.ARTIFACTS) return new ArtifactsGitHost(env.ARTIFACTS, integrator(env));
  if (!env.GIT_REMOTE_BASE) throw new Error('no git host: bind ARTIFACTS or set GIT_REMOTE_BASE');
  return new GitServerHost(env.GIT_REMOTE_BASE, (i, init) => fetch(i, init), env.GIT_PUBLIC_BASE ?? env.GIT_REMOTE_BASE);
}

export function integrator(env: Env): WorkcellClient {
  if (env.INTEGRATOR_URL) return new WorkcellClient(env.INTEGRATOR_URL);
  return workcellClient(env, `integrator:${org(env)}`, 'integrator');
}

export function workcells(env: Env): { name: string; client: WorkcellClient }[] {
  if (env.WORKCELL_URLS) {
    return env.WORKCELL_URLS.split(',').map((url, i) => ({ name: `workcell-${i}`, client: new WorkcellClient(url.trim()) }));
  }
  const n = Number(env.WORKCELLS ?? '2');
  return Array.from({ length: n }, (_, i) => {
    const name = `workcell:${org(env)}:${i}`;
    return { name, client: workcellClient(env, name, 'workcell') };
  });
}

let bank: Promise<TaskBank> | null = null;

/** The demo formula engine, its task bank and reference solutions, from the Worker's assets. */
export async function templates(env: Env): Promise<Template[]> {
  bank ??= jsonAsset<TaskBank>(env, '/bench/tasks.json').then((b) => {
    if (!b) throw new Error('task bank missing from assets (pnpm --filter @livemain/edge assets)');
    return b;
  });
  const tasks = (await bank).tasks;
  return [
    {
      id: 'formula-engine',
      name: 'Formula engine (demo)',
      description: 'A TypeScript spreadsheet formula engine, stubbed, with 336 tasks and their acceptance tests',
      seed: { kind: 'dir', dir: '/seed/demo-repo' },
      tasks,
      solution: (taskId: string, naive = false) => solution(env, taskId, naive),
    },
  ];
}

/** JSON assets only: with single-page-app serving, a missing asset comes back as index.html (200). */
async function jsonAsset<T>(env: Env, path: string): Promise<T | undefined> {
  const res = await env.ASSETS.fetch(`http://assets${path}`);
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return undefined;
  return (await res.json()) as T;
}

export function solution(env: Env, taskId: string, naive = false): Promise<Solution | undefined> {
  return jsonAsset<Solution>(env, `/bench/solutions/${taskId}${naive ? '.naive' : ''}.json`);
}
