import type { RepoEvent } from '@livemain/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { handleV1 } from '../src/index.js';
import { MARKER, until, world } from './world.js';

const scripted = [{ when: 'default' as const, worker: { kind: 'scripted' as const } }];
let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => {
  await cleanup?.();
  cleanup = null;
});

describe('API v1 service', () => {
  it('creates a template repo, dispatches a swarm, and serves its landings, agents and live events', async () => {
    const { api } = world();
    cleanup = () => api.close();
    const repo = await api.org.createRepo({ name: 'engine', from: { kind: 'template', template: 'demo' } });
    const engine = await api.repo('acme', 'engine');
    expect(repo).toMatchObject({ fullName: 'acme/engine', template: 'demo', main: { version: 1 } });
    expect(engine.tasks().map((t) => [t.id, t.status, t.kind])).toEqual([
      ['fn-SUM', 'open', 'feature'],
      ['fn-AVG', 'open', 'feature'],
      ['fn-MAX', 'open', 'feature'],
    ]);

    const events: RepoEvent[] = [];
    const off = engine.subscribe((e) => events.push(e));
    // AVG depends on SUM: dispatching AVG alone pulls SUM in.
    const swarm = await engine.dispatch({ taskIds: ['fn-AVG', 'fn-MAX'], concurrency: 2, rules: scripted, name: 'batch 1' });
    expect(swarm.taskIds.sort()).toEqual(['fn-AVG', 'fn-MAX', 'fn-SUM']);
    const done = await until(() => {
      const s = engine.swarm(swarm.id);
      return s.status === 'finished' && s;
    });
    off();
    expect(done.counts).toMatchObject({ total: 3, landed: 3, failed: 0 });
    expect(engine.tasks().every((t) => t.status === 'landed')).toBe(true);
    expect(engine.view().main?.version).toBe(4);

    const landings = engine.landings();
    expect(landings.map((l) => l.version)).toEqual([4, 3, 2, 1]);
    expect(landings.at(-1)).toMatchObject({ title: 'Initial commit', by: { kind: 'seed' } });
    const first = landings.find((l) => l.title === 'Implement SUM')!;
    expect(first.by).toMatchObject({ kind: 'agent', swarmId: swarm.id, worker: { kind: 'scripted' } });

    const detail = await engine.landing(first.version);
    const reg = detail.patches.find((p) => p.path === 'src/registry.ts')!;
    expect(reg).toMatchObject({ added: 1, removed: 0, class: 'additive' });
    expect(detail.patches.find((p) => p.path === 'src/SUM.ts')?.status).toBe('added');

    const agents = engine.agents({ swarmId: swarm.id });
    expect(agents).toHaveLength(3);
    expect(agents.every((a) => a.state === 'landed' && a.landedVersion !== null)).toBe(true);
    const agent = await engine.agent(agents[0]!.id);
    expect(agent.steps.length).toBeGreaterThan(2);
    expect(agent.testRuns.at(-1)?.ok).toBe(true);
    expect(agent.patches.length).toBeGreaterThan(0);

    const types = new Set(events.map((e) => e.type));
    expect(types).toEqual(new Set(['agent', 'swarm', 'main']));
    const tree = await engine.tree();
    expect(tree.find((e) => e.path === 'src/SUM.ts')).toMatchObject({ type: 'file', writers: 0 });
    const file = await engine.file('src/registry.ts');
    expect(file.content).toContain('SUM:');
    expect(file.version).toBe(4);
    // the last landing to touch a file comes from the landings table
    expect(file.lastLanding?.version).toBe(4);
    expect((await engine.file('src/SUM.ts')).lastLanding?.title).toBe('Implement SUM');
    expect((await engine.file('README.md')).lastLanding?.version).toBe(1);
    expect((await engine.file('src/registry.ts', detail.sha)).lastLanding?.version).toBe(first.version);
  });

  it('stops a swarm: running agents stop and unstarted tasks reopen', async () => {
    const { api } = world(['A', 'B', 'C', 'D', 'E', 'F']);
    cleanup = () => api.close();
    await api.org.createRepo({ name: 'engine', from: { kind: 'template', template: 'demo' } });
    const engine = await api.repo('acme', 'engine');
    const swarm = await engine.dispatch({ taskIds: ['fn-C', 'fn-D', 'fn-E', 'fn-F'], concurrency: 1, rules: scripted });
    engine.stop(swarm.id);
    const s = await until(() => {
      const v = engine.swarm(swarm.id);
      return v.status === 'stopped' && v;
    });
    expect(s.reason).toBe('stopped by you');
    expect(engine.tasks({ status: 'open' }).length).toBeGreaterThanOrEqual(5);
    // A finished swarm keeps its numbers when its tasks are dispatched again.
    const before = engine.swarm(swarm.id).counts;
    const again = await engine.dispatch({ taskIds: ['fn-C', 'fn-D', 'fn-E', 'fn-F'].filter((t) => engine.tasks({ status: 'open' }).some((x) => x.id === t)), concurrency: 2, rules: scripted });
    await until(() => engine.swarm(again.id).status === 'finished');
    expect(engine.swarm(swarm.id).counts).toEqual(before);
  });

  it('holds a landing on a protected path until a person approves it, and records who', async () => {
    const { api } = world(['SUM']);
    cleanup = () => api.close();
    await api.org.createRepo({ name: 'engine', from: { kind: 'template', template: 'demo' } });
    const engine = await api.repo('acme', 'engine');
    expect(engine.setPolicy({ protectedPaths: ['src/registry.ts'] })).toEqual({ protectedPaths: ['src/registry.ts'] });
    const swarm = await engine.dispatch({ taskIds: ['fn-SUM'], concurrency: 1, rules: scripted }, 'lina@acme.dev');
    expect(swarm.dispatchedBy).toBe('lina@acme.dev');
    const pending = await until(() => engine.approvals('pending')[0]);
    expect(pending).toMatchObject({ paths: ['src/registry.ts'], taskTitle: 'Implement SUM', swarmId: swarm.id });
    expect(engine.agents({ swarmId: swarm.id })[0]).toMatchObject({ state: 'ready', detail: 'waiting for a person to approve changes to src/registry.ts' });
    expect(engine.decide(pending.id, true, 'omar@acme.dev', 'ok')).toMatchObject({ status: 'approved', decidedBy: 'omar@acme.dev' });
    await until(() => engine.swarm(swarm.id).status === 'finished', 10_000);
    const landing = engine.landings()[0]!;
    expect(landing.approval).toEqual({ by: 'omar@acme.dev', paths: ['src/registry.ts'] });
    expect(landing.by).toMatchObject({ kind: 'agent', delegatedBy: 'lina@acme.dev' });
    expect(() => engine.decide(pending.id, false, 'x')).toThrow(/already approved/);
  });

  it('external agents claim a seat and work through tool calls', async () => {
    const { api } = world(['SUM']);
    cleanup = () => api.close();
    await api.org.createRepo({ name: 'engine', from: { kind: 'template', template: 'demo' } });
    const engine = await api.repo('acme', 'engine');
    await expect(engine.claim('omar')).rejects.toMatchObject({ code: 'no-open-task' });
    const swarm = await engine.dispatch({ taskIds: ['fn-SUM'], concurrency: 1, rules: [{ when: 'default', worker: { kind: 'external', name: 'Claude Code' } }] }, 'lina');
    await until(() => engine.agents({ swarmId: swarm.id })[0]?.detail === 'waiting for Claude Code to claim it');

    const claimed = await engine.claim('omar', swarm.id);
    expect(claimed).toMatchObject({ swarmId: swarm.id, repo: 'acme/engine', task: { id: 'fn-SUM', title: 'Implement SUM', tests: ['tests/SUM.test.ts'] } });
    expect(claimed.brief).toContain('Live Main');
    expect(engine.agent(claimed.agentId)).resolves.toMatchObject({ state: 'working', detail: 'claimed by omar (Claude Code)' });
    await expect(engine.claim('someone-else')).rejects.toMatchObject({ code: 'no-open-task' });
    await expect(engine.agentTool(claimed.agentId, 'mallory', 'read_file', { path: 'README.md' })).rejects.toMatchObject({ code: 'not-your-agent' });

    const id = claimed.agentId;
    expect((await engine.agentTool(id, 'omar', 'read_file', { path: 'src/registry.ts' })).text).toContain('registry');
    await engine.agentTool(id, 'omar', 'write_file', { path: 'src/SUM.ts', content: 'export default 1;\n' });
    const reg = (await engine.file('src/registry.ts')).content!;
    await engine.agentTool(id, 'omar', 'write_file', { path: 'src/registry.ts', content: reg.replace(MARKER, `  SUM: () => import('./SUM'),\n${MARKER}`) });
    expect((await engine.agentTool(id, 'omar', 'run_tests', {})).isError).toBe(false);
    const sub = await engine.agentTool(id, 'omar', 'submit', { message: 'add SUM' });
    expect(sub, sub.text).toMatchObject({ landed: true, isError: false });
    await until(() => engine.swarm(swarm.id).status === 'finished');
    expect(engine.swarm(swarm.id).counts).toMatchObject({ landed: 1 });
    await expect(engine.agentTool(id, 'omar', 'read_file', { path: 'README.md' })).rejects.toMatchObject({ code: 'not-running' });
  });

  it('validates dispatch: keys, replay workers and capacity', async () => {
    const { api } = world();
    cleanup = () => api.close();
    await api.org.createRepo({ name: 'plain', from: { kind: 'empty' }, description: 'just a readme' });
    const plain = await api.repo('acme', 'plain');
    expect(await plain.file('README.md')).toMatchObject({ content: '# plain\n\njust a readme\n' });
    await expect(plain.dispatch({ newTasks: [{ title: 'Add a LICENSE' }], concurrency: 1, rules: scripted })).rejects.toMatchObject({ code: 'no-solutions' });
    await expect(
      plain.dispatch({ newTasks: [{ title: 'x' }], concurrency: 1, rules: [{ when: 'default', worker: { kind: 'model', provider: 'openai', model: 'm' } }] }),
    ).rejects.toMatchObject({ code: 'missing-key' });
    const est = await plain.estimate({ taskIds: [], concurrency: 4, rules: [{ when: 'default', worker: { kind: 'model', provider: 'anthropic', model: 'claude-haiku-4-5' } }] });
    expect(est).toMatchObject({ tasks: 0, missingKeys: ['anthropic'] });
    await expect(api.org.createRepo({ name: 'gh', from: { kind: 'github', repo: 'acme/x', landing: 'pull-request' } })).rejects.toMatchObject({ status: 501 });
    await expect(api.org.createRepo({ name: 'plain', from: { kind: 'empty' } })).rejects.toMatchObject({ status: 409 });
  });

  it('keeps keys sealed and write-only', async () => {
    const { api, dbs } = world();
    cleanup = () => api.close();
    const info = await api.org.setKey({ provider: 'openai-compatible', key: 'sk-local-1234567890', baseUrl: 'http://127.0.0.1:9/v1' });
    expect(info).toMatchObject({ provider: 'openai-compatible', last4: '7890', test: { ok: false } });
    expect(JSON.stringify(api.org.keys())).not.toContain('sk-local');
    const stored = dbs.get('org')!.all<{ sealed: string }>(`SELECT sealed FROM keys`)[0]!.sealed;
    expect(stored).not.toContain('sk-local');
  });
});

describe('API v1 router', () => {
  it('signs the CLI in with a device code and serves /cli/v1 with its token', async () => {
    const { api } = world();
    cleanup = () => api.close();
    const handle = handleV1(api);
    const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
      const res = (await handle(new Request(`http://host.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })))!;
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };
    const start = (await call('POST', '/cli/device/code')).body as { deviceCode: string; userCode: string; verificationUrl: string };
    expect(start.verificationUrl).toBe(`http://host.test/device?code=${start.userCode}`);
    expect((await call('POST', '/cli/device/token', { deviceCode: start.deviceCode })).body).toEqual({ status: 'pending' });
    // approving needs a signed-in person: in the browser, /v1 (here as the local user)
    expect((await call('POST', '/v1/device/approve', { userCode: 'NOPE-NOPE' })).status).toBe(404);
    expect((await call('POST', '/v1/device/approve', { userCode: start.userCode.toLowerCase() })).status).toBe(200);
    const done = (await call('POST', '/cli/device/token', { deviceCode: start.deviceCode })).body as { status: string; token: string; person: string };
    expect(done).toMatchObject({ status: 'approved', person: 'lina' });
    expect((await call('POST', '/cli/device/token', { deviceCode: start.deviceCode })).body).toEqual({ status: 'expired' });

    const auth = { authorization: `Bearer ${done.token}` };
    expect((await call('GET', '/cli/v1/session', undefined, auth)).body).toMatchObject({ user: { login: 'lina' } });
    expect((await call('GET', '/cli/v1/tokens', undefined, auth)).body).toMatchObject([{ name: expect.stringMatching(/^lm CLI/) }]);
    expect((await call('GET', '/cli/v1/session', undefined, { authorization: 'Bearer lm_wrong' })).status).toBe(401);
  });


  it('maps org and repo routes and errors', async () => {
    const { api } = world();
    cleanup = () => api.close();
    const handle = handleV1(api);
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await handle(new Request(`http://x${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
      return { status: res!.status, body: res!.headers.get('content-type')?.includes('json') ? await res!.json() : null, res: res! };
    };
    expect(await handle(new Request('http://x/index.html'))).toBeNull();
    expect((await call('GET', '/v1/session')).body).toMatchObject({ org: 'acme' });
    expect((await call('POST', '/v1/repos', { name: 'r1', from: { kind: 'template', template: 'demo' } })).status).toBe(200);
    expect((await call('GET', '/v1/repos/acme/r1')).body).toMatchObject({ fullName: 'acme/r1' });
    expect((await call('GET', '/v1/repos/acme/r1/files/src/registry.ts')).body).toMatchObject({ path: 'src/registry.ts' });
    expect(await call('GET', '/v1/repos/acme/nope')).toMatchObject({ status: 404, body: { error: 'not-found' } });
    expect(await call('POST', '/v1/repos', 'not json')).toMatchObject({ status: 400 });

    // Swarms and agents are addressed under their repository (one RepoDO per repo on Cloudflare).
    const swarm = (await call('POST', '/v1/repos/acme/r1/swarms', { taskIds: ['fn-SUM'], concurrency: 1, rules: scripted })).body as { id: string };
    const done = await until(async () => {
      const s = (await call('GET', `/v1/repos/acme/r1/swarms/${swarm.id}`)).body as { status: string };
      return s.status === 'finished' && s;
    });
    expect(done).toMatchObject({ status: 'finished', counts: { landed: 1 } });
    const agents = (await call('GET', `/v1/repos/acme/r1/agents?swarm=${swarm.id}`)).body as { id: string }[];
    expect((await call('GET', `/v1/repos/acme/r1/agents/${agents[0]!.id}`)).body).toMatchObject({ state: 'landed' });
    expect(await call('POST', `/v1/repos/acme/r1/swarms/${swarm.id}/pause`)).toMatchObject({ status: 409, body: { error: 'not-running' } });
    expect(await call('GET', '/v1/swarms/x')).toMatchObject({ status: 404 });
  });
});
