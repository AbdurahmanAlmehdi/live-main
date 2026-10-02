import type { ChangeClass, IntegrateRequest, IntegrateResponse, Notice, PromoteRequest } from '@livemain/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { Coordinator } from '../src/coordinator.js';
import { nodeSqlStore } from '../src/node-sql.js';

/** Fake integrator: main is a counter of shas; classes come from a per-test table. */
class FakeIntegrator {
  calls: IntegrateRequest[] = [];
  head = 'sha-1';
  n = 1;
  classes: Record<string, ChangeClass> = {};
  next: ((req: IntegrateRequest) => IntegrateResponse | undefined) | null = null;

  async integrate(req: IntegrateRequest): Promise<IntegrateResponse> {
    this.calls.push(req);
    const forced = this.next?.(req);
    if (forced) return forced;
    if (req.expectedHeadSha !== this.head) return { ok: false, error: 'head-moved', actualHeadSha: this.head };
    const parent = this.head;
    this.head = `sha-${++this.n}`;
    const changedPaths = req.changes.map((c) => c.path);
    return {
      ok: true,
      sha: this.head,
      parent,
      changedPaths,
      classes: Object.fromEntries(changedPaths.map((p) => [p, this.classes[p] ?? 'body'])),
      merged: req.autoMerge.map((path) => ({ path, method: 'union' })),
      impact: null,
      impactRan: [],
    };
  }
}

function setup(protectedPaths: string[] = []) {
  const integrator = new FakeIntegrator();
  const delivered: Notice[] = [];
  let t = 1000;
  const coord = new Coordinator({
    sql: nodeSqlStore(),
    integrator,
    remote: 'http://gitserver/main.git',
    clock: { now: () => t++ },
    deliver: (_a, n) => delivered.push(n),
    protectedPaths: () => protectedPaths,
  });
  coord.init('sha-1');
  return { coord, integrator, delivered };
}

const file = (path: string) => ({ path, content: `// ${path}` });

function promoteReq(agentId: string, pin: number, reads: string[], writes: string[], extra: Partial<PromoteRequest> = {}): PromoteRequest {
  return {
    agentId,
    pin,
    readSet: reads,
    writeSet: writes,
    changes: writes.map(file),
    testsRun: [`tests/${agentId}.test.ts`],
    message: `promote ${agentId}`,
    ...extra,
  };
}

describe('Coordinator: worked example from the brainstorm', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
    for (const a of ['A', 'B', 'C']) s.coord.register({ agentId: a, taskId: `task-${a}`, strategy: 'live-main', workcell: 'wc-1' });
    s.integrator.classes = { 'src/value.ts': 'signature', 'src/registry.ts': 'additive', 'src/sum.ts': 'additive', 'src/date.ts': 'additive' };
    s.coord.reportSets('A', ['src/value.ts', 'src/registry.ts'], ['src/sum.ts', 'src/registry.ts']);
    s.coord.reportSets('B', ['src/value.ts', 'src/registry.ts'], ['src/date.ts', 'src/registry.ts']);
    s.coord.reportSets('C', ['src/registry.ts'], ['src/value.ts']);
  });

  it('C lands v2 and readers of value.ts are notified at review/interrupt severity', async () => {
    const r = await s.coord.promote(promoteReq('C', 1, ['src/registry.ts'], ['src/value.ts']));
    expect(r).toMatchObject({ status: 'landed', version: 2 });
    const toA = s.delivered.filter((n) => n.agentId === 'A');
    expect(toA).toHaveLength(1);
    expect(toA[0]).toMatchObject({ path: 'src/value.ts', severity: 'interrupt', kind: 'moved', version: 2 });
  });

  it('A must checkpoint (read-write staleness), then lands v3 without a rebase', async () => {
    await s.coord.promote(promoteReq('C', 1, ['src/registry.ts'], ['src/value.ts']));
    const stale = await s.coord.promote(promoteReq('A', 1, ['src/value.ts', 'src/registry.ts'], ['src/sum.ts', 'src/registry.ts']));
    expect(stale).toEqual({ status: 'stale', head: 2, reasons: [{ path: 'src/value.ts', why: 'read-write', class: 'signature' }] });

    const cp = s.coord.checkpointBegin('A');
    expect(cp).toMatchObject({ from: 1, to: 2, delta: { 'src/value.ts': 'signature' } });
    s.coord.checkpointCommit({ agentId: 'A', to: 2, readSet: ['src/value.ts', 'src/registry.ts'], writeSet: ['src/sum.ts', 'src/registry.ts'], notices: [] });
    const landed = await s.coord.promote(promoteReq('A', 2, ['src/value.ts', 'src/registry.ts'], ['src/sum.ts', 'src/registry.ts']));
    expect(landed).toMatchObject({ status: 'landed', version: 3 });
  });

  it('B jumps v1→v3: value.ts needs review, registry.ts auto-merges at promotion', async () => {
    await s.coord.promote(promoteReq('C', 1, ['src/registry.ts'], ['src/value.ts']));
    s.coord.checkpointCommit({ agentId: 'A', to: 2, readSet: ['src/value.ts'], writeSet: ['src/sum.ts', 'src/registry.ts'], notices: [] });
    await s.coord.promote(promoteReq('A', 2, ['src/value.ts', 'src/registry.ts'], ['src/sum.ts', 'src/registry.ts']));

    const first = await s.coord.promote(promoteReq('B', 1, ['src/value.ts', 'src/registry.ts'], ['src/date.ts', 'src/registry.ts']));
    expect(first.status).toBe('stale');
    expect(first.status === 'stale' && first.reasons.map((r) => r.path)).toEqual(['src/value.ts']);

    // Only paths B read or wrote are reported (A's new sum.ts is irrelevant to B).
    expect(s.coord.checkpointBegin('B')).toMatchObject({ from: 1, to: 3, delta: { 'src/value.ts': 'signature', 'src/registry.ts': 'additive' } });
    expect(s.coord.checkpointBegin('B').delta).not.toHaveProperty('src/sum.ts');
    // B checkpoints only to v2 (after C), then A's registry addition (v3) must auto-merge at promotion.
    s.coord.checkpointCommit({ agentId: 'B', to: 2, readSet: ['src/value.ts', 'src/registry.ts'], writeSet: ['src/date.ts', 'src/registry.ts'], notices: [] });
    const landed = await s.coord.promote(promoteReq('B', 2, ['src/value.ts', 'src/registry.ts'], ['src/date.ts', 'src/registry.ts']));
    expect(landed).toMatchObject({ status: 'landed', version: 4 });
    expect(s.integrator.calls.at(-1)?.autoMerge).toEqual(['src/registry.ts']);
    expect(s.coord.head()).toEqual({ version: 4, sha: 'sha-4' });
  });
});

describe('Coordinator: promotion rule details', () => {
  it('additive changes to a read file do not make the overlay stale', async () => {
    const s = setup();
    s.integrator.classes = { 'src/registry.ts': 'additive', 'src/x.ts': 'additive' };
    s.coord.register({ agentId: 'X', taskId: 't', strategy: 'live-main', workcell: 'w' });
    s.coord.register({ agentId: 'Y', taskId: 't', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('X', 1, [], ['src/registry.ts', 'src/x.ts']));
    const r = await s.coord.promote(promoteReq('Y', 1, ['src/registry.ts'], ['src/y.ts']));
    expect(r.status).toBe('landed');
    expect(s.integrator.calls.at(-1)?.autoMerge).toEqual([]);
  });

  it('non-additive change to a written file is stale (write-write)', async () => {
    const s = setup();
    s.integrator.classes = { 'src/shared.ts': 'body' };
    s.coord.register({ agentId: 'X', taskId: 't', strategy: 'live-main', workcell: 'w' });
    s.coord.register({ agentId: 'Y', taskId: 't', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('X', 1, [], ['src/shared.ts']));
    const r = await s.coord.promote(promoteReq('Y', 1, [], ['src/shared.ts']));
    expect(r).toMatchObject({ status: 'stale', reasons: [{ path: 'src/shared.ts', why: 'write-write', class: 'body' }] });
    expect(s.integrator.calls).toHaveLength(1);
  });

  it('impact candidates come from landed read sets, excluding the promoter’s own tests', async () => {
    const s = setup();
    s.coord.register({ agentId: 'F', taskId: 'fn-F', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('F', 1, ['src/helpers/h.ts', 'src/F.ts'], ['src/F.ts'], { testsRun: ['tests/F.test.ts'] }));
    s.coord.register({ agentId: 'T', taskId: 'trap', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('T', 2, ['src/helpers/h.ts'], ['src/helpers/h.ts'], { testsRun: ['tests/T.test.ts'] }));
    expect(s.integrator.calls.at(-1)?.impactCandidates).toEqual({ 'src/helpers/h.ts': ['tests/F.test.ts'] });
  });

  it('impact failure is reported to the promoter as an interrupt and nothing lands', async () => {
    const s = setup();
    s.coord.register({ agentId: 'T', taskId: 'trap', strategy: 'live-main', workcell: 'w' });
    s.integrator.next = () => ({
      ok: false,
      error: 'impact-failed',
      results: { ok: false, passed: 0, failed: 1, durationMs: 1, output: '', files: [{ file: 'tests/F.test.ts', ok: false, failures: [{ name: 'F empty', message: 'expected 0' }] }] },
    });
    const r = await s.coord.promote(promoteReq('T', 1, [], ['src/helpers/h.ts']));
    expect(r).toMatchObject({ status: 'impact-failed', failures: [{ file: 'tests/F.test.ts' }] });
    expect(s.coord.head().version).toBe(1);
    expect(s.coord.overlay('T').status).toBe('active');
    expect(s.delivered).toMatchObject([{ agentId: 'T', kind: 'impact', severity: 'interrupt' }]);
  });

  it('change orders jump the queue', async () => {
    const s = setup();
    for (const a of ['a', 'b', 'co']) s.coord.register({ agentId: a, taskId: a, strategy: 'live-main', workcell: 'w' });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const order: string[] = [];
    const real = s.integrator.integrate.bind(s.integrator);
    s.integrator.integrate = async (req) => {
      if (order.length === 0) await gate;
      order.push(req.message);
      return real(req);
    };
    s.integrator.classes = { 'a.ts': 'additive', 'b.ts': 'additive', 'core.ts': 'signature' };
    const pa = s.coord.promote(promoteReq('a', 1, [], ['a.ts']));
    const pb = s.coord.promote(promoteReq('b', 1, [], ['b.ts']));
    const pco = s.coord.promote(promoteReq('co', 1, [], ['core.ts'], { priority: true }));
    release();
    await Promise.all([pa, pb, pco]);
    expect(order).toEqual(['promote a', 'promote co', 'promote b']);
  });

  it('change-order landing escalates read hits to interrupt', async () => {
    const s = setup();
    s.integrator.classes = { 'src/core/args.ts': 'body' };
    s.coord.register({ agentId: 'leaf', taskId: 'fn', strategy: 'live-main', workcell: 'w' });
    s.coord.register({ agentId: 'co', taskId: 'co-1', strategy: 'live-main', workcell: 'w' });
    s.coord.reportSets('leaf', ['src/core/args.ts'], ['src/functions/SUM.ts']);
    await s.coord.promote(promoteReq('co', 1, [], ['src/core/args.ts'], { priority: true }));
    expect(s.delivered).toMatchObject([{ agentId: 'leaf', kind: 'change-order', severity: 'interrupt' }]);
    expect(s.coord.versions(1)[0]).toMatchObject({ version: 2, changeOrder: true });
  });

  it('rejects pin mismatch and empty overlays', async () => {
    const s = setup();
    s.coord.register({ agentId: 'z', taskId: 't', strategy: 'live-main', workcell: 'w' });
    expect(await s.coord.promote(promoteReq('z', 7, [], ['a.ts']))).toMatchObject({ status: 'rejected' });
    expect(await s.coord.promote(promoteReq('z', 1, [], []))).toMatchObject({ status: 'rejected', reason: 'empty overlay' });
  });

  it('delta takes the max class across versions', async () => {
    const s = setup();
    s.coord.register({ agentId: 'p', taskId: 't', strategy: 'live-main', workcell: 'w' });
    s.integrator.classes = { 'a.ts': 'additive' };
    await s.coord.promote(promoteReq('p', 1, [], ['a.ts']));
    s.coord.register({ agentId: 'q', taskId: 't', strategy: 'live-main', workcell: 'w' });
    s.integrator.classes = { 'a.ts': 'signature' };
    await s.coord.promote(promoteReq('q', 2, [], ['a.ts']));
    expect(s.coord.delta(1, 3)).toEqual({ 'a.ts': 'signature' });
    expect(s.coord.delta(2, 3)).toEqual({ 'a.ts': 'signature' });
    expect(s.coord.delta(1, 2)).toEqual({ 'a.ts': 'additive' });
  });

  it('records external landings and CI', () => {
    const s = setup();
    const v = s.coord.recordExternalLanding({ agentId: 'b1', taskId: 't', sha: 'ext-2', parentSha: 'sha-1', changes: { 'a.ts': 'body' } });
    expect(v).toBe(2);
    expect(s.coord.recordExternalLanding({ agentId: 'b1', taskId: 't', sha: 'ext-2', parentSha: 'sha-1', changes: {} })).toBe(2);
    s.coord.recordCi(2, 'ext-2', { passed: 3, failed: 1, files: [{ file: 'x', ok: false, failures: [] }] });
    expect(s.coord.latestCi()).toMatchObject({ version: 2, failing: ['x'] });
    expect(s.coord.events().map((e) => e.event.type)).toContain('ci');
  });
});

describe('Coordinator: a person pushing to main', () => {
  it('lands through the promotion rule, runs impact tests and notifies agents that read the path', async () => {
    const s = setup();
    s.coord.register({ agentId: 'F', taskId: 'fn-F', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('F', 1, ['src/helpers/h.ts', 'src/F.ts'], ['src/F.ts'], { testsRun: ['tests/F.test.ts'] }));
    s.coord.register({ agentId: 'R', taskId: 'fn-R', strategy: 'live-main', workcell: 'w' });
    s.coord.reportSets('R', ['src/helpers/h.ts'], []);
    const r = await s.coord.promoteChange({ person: 'lina@acme.dev', base: 2, changes: [file('src/helpers/h.ts')], message: 'Fix rounding in h\n\nbody' });
    expect(r).toMatchObject({ status: 'landed', version: 3 });
    const call = s.integrator.calls.at(-1)!;
    expect(call.impactCandidates).toEqual({ 'src/helpers/h.ts': ['tests/F.test.ts'] });
    expect(call.author).toBe('lina@acme.dev <lina@acme.dev>');
    expect(s.delivered).toMatchObject([{ agentId: 'R', kind: 'moved', path: 'src/helpers/h.ts', version: 3 }]);
    expect(s.coord.events().map((e) => e.event).find((e) => e.type === 'landed' && e.version === 3)).toMatchObject({ agentId: 'person:lina@acme.dev', pushedBy: 'lina@acme.dev', title: 'Fix rounding in h', taskId: null });
  });

  it('a push made on an older main merges additive changes and refuses real conflicts', async () => {
    const s = setup();
    s.integrator.classes = { 'src/registry.ts': 'additive', 'src/shared.ts': 'body' };
    s.coord.register({ agentId: 'X', taskId: 't', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('X', 1, [], ['src/registry.ts', 'src/shared.ts']));
    const merged = await s.coord.promoteChange({ person: 'lina', base: 1, changes: [file('src/registry.ts')], message: 'register mine' });
    expect(merged.status).toBe('landed');
    expect(s.integrator.calls.at(-1)?.autoMerge).toEqual(['src/registry.ts']);
    const refused = await s.coord.promoteChange({ person: 'lina', base: 1, changes: [file('src/shared.ts')], message: 'edit shared' });
    expect(refused).toMatchObject({ status: 'stale', reasons: [{ path: 'src/shared.ts', why: 'write-write' }] });
    expect(await s.coord.promoteChange({ person: 'lina', base: 99, changes: [file('a')], message: 'x' })).toMatchObject({ status: 'rejected' });
  });

  it('an impact failure refuses the push without notices', async () => {
    const s = setup();
    s.integrator.next = () => ({
      ok: false,
      error: 'impact-failed',
      results: { ok: false, passed: 0, failed: 1, durationMs: 1, output: '', files: [{ file: 'tests/F.test.ts', ok: false, failures: [{ name: 'F', message: 'boom' }] }] },
    });
    const r = await s.coord.promoteChange({ person: 'lina', base: 1, changes: [file('src/h.ts')], message: 'break' });
    expect(r).toMatchObject({ status: 'impact-failed', failures: [{ file: 'tests/F.test.ts' }] });
    expect(s.delivered).toEqual([]);
    expect(s.coord.head().version).toBe(1);
  });
});

describe('Coordinator: approvals for protected paths', () => {
  it('holds an agent landing on a protected path until a person approves it', async () => {
    const s = setup(['src/core/**']);
    s.coord.register({ agentId: 'A', taskId: 'fn-A', strategy: 'live-main', workcell: 'w' });
    const held = await s.coord.promote(promoteReq('A', 1, [], ['src/core/value.ts', 'src/A.ts']));
    expect(held).toMatchObject({ status: 'awaiting-approval', paths: ['src/core/value.ts'] });
    expect(s.integrator.calls).toHaveLength(0);
    // re-submitting while pending does not create a second request
    const again = await s.coord.promote(promoteReq('A', 1, [], ['src/core/value.ts', 'src/A.ts']));
    expect(again).toMatchObject({ status: 'awaiting-approval', approvalId: held.status === 'awaiting-approval' ? held.approvalId : '' });
    expect(s.coord.approvals('pending')).toHaveLength(1);

    const id = s.coord.approvals('pending')[0]!.id;
    expect(s.coord.decide(id, true, 'lina@acme.dev', 'looks right')).toMatchObject({ status: 'approved', decidedBy: 'lina@acme.dev' });
    expect(() => s.coord.decide(id, false, 'x')).toThrow(/already approved/);
    const landed = await s.coord.promote(promoteReq('A', 1, [], ['src/core/value.ts', 'src/A.ts']));
    expect(landed).toMatchObject({ status: 'landed', version: 2 });
    const ev = s.coord.events().map((e) => e.event).find((e) => e.type === 'landed' && e.version === 2);
    expect(ev).toMatchObject({ approval: { id, by: 'lina@acme.dev', paths: ['src/core/value.ts'] } });
  });

  it('a rejection is returned to the agent; unprotected landings and pushes are not held', async () => {
    const s = setup(['package.json']);
    s.coord.register({ agentId: 'B', taskId: 'fn-B', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('B', 1, [], ['package.json']));
    s.coord.decide(s.coord.approvals('pending')[0]!.id, false, 'lina', 'no new dependencies');
    expect(await s.coord.promote(promoteReq('B', 1, [], ['package.json']))).toMatchObject({ status: 'rejected', reason: 'a reviewer rejected the change to package.json: no new dependencies' });

    // an agent that ends while waiting withdraws its request
    s.coord.register({ agentId: 'D', taskId: 'fn-D', strategy: 'live-main', workcell: 'w' });
    await s.coord.promote(promoteReq('D', 1, [], ['package.json']));
    s.coord.finish('D', 'failed');
    expect(s.coord.approvals().find((a) => a.agentId === 'D')).toMatchObject({ status: 'withdrawn' });

    s.coord.register({ agentId: 'C', taskId: 'fn-C', strategy: 'live-main', workcell: 'w' });
    expect((await s.coord.promote(promoteReq('C', 1, [], ['src/C.ts']))).status).toBe('landed');
    expect((await s.coord.promoteChange({ person: 'lina', base: 2, changes: [file('package.json')], message: 'bump' })).status).toBe('landed');
  });
});
