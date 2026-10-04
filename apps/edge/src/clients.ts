import { HttpCoordinatorClient, WorkcellClient, type FetchLike } from '@livemain/core';
import type { Env } from './env.js';
import type { WorkcellRole } from './workcell-do.js';

/** Typed workcell client whose transport is the Workcell Durable Object hosting the container. */
export function workcellClient(env: Env, name: string, role: WorkcellRole): WorkcellClient {
  const stub = env.WORKCELL.get(env.WORKCELL.idFromName(name));
  const fetchImpl: FetchLike = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('x-livemain-role', role);
    const started = Date.now();
    const res = await stub.fetch(new Request(input, { ...init, headers }));
    if (!env.LIVEMAIN_DEBUG) return res;
    const body = await res.text();
    console.log(`workcell ${name} ${init?.method ?? 'GET'} ${new URL(input).pathname} → ${res.status} ${Date.now() - started}ms ${body.slice(0, 120)}`);
    return new Response(body, { status: res.status, headers: res.headers });
  };
  return new WorkcellClient('http://workcell', fetchImpl);
}

export function integratorName(runId: string): string {
  return `integrator:${runId}`;
}

export function workcellName(runId: string, i: number): string {
  return `workcell:${runId}:${i}`;
}

/** Coordinator API over the run's Coordinator Durable Object. */
export function coordinatorClient(env: Env, runId: string): HttpCoordinatorClient {
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(runId));
  return new HttpCoordinatorClient('http://coordinator', (input, init) => stub.fetch(new Request(input, init)));
}
