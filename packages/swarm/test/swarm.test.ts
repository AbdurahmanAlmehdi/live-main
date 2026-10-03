import type { RunEvent, Task } from '@livemain/protocol';
import { describe, expect, it } from 'vitest';
import { computeMetrics, runSwarm, Scheduler, scoreboard } from '../src/index.js';

const t = (id: string, kind: Task['kind'], dependsOn: string[] = [], releaseAt?: number): Task => ({
  id,
  kind,
  title: id,
  prompt: id,
  tests: [`tests/${id}.test.ts`],
  dependsOn,
  releaseAt,
});

describe('Scheduler', () => {
  it('runs helpers before leaves, respects dependencies, releases change orders by progress', () => {
    const s = new Scheduler([t('leaf-a', 'leaf'), t('leaf-b', 'leaf', ['helper-x']), t('helper-x', 'helper'), t('co-1', 'change-order', [], 0.5), t('leaf-c', 'leaf')]);
    expect(s.next()?.id).toBe('helper-x');
    expect(s.next()?.id).toBe('leaf-a');
    expect(s.next()?.id).toBe('leaf-c');
    expect(s.next()).toBeNull(); // leaf-b waits for helper-x; co-1 not released
    s.finish('helper-x', 'landed');
    s.finish('leaf-a', 'landed');
    expect(s.takeReleased().map((x) => x.id)).toEqual(['co-1']); // 2/4 regular tasks landed
    expect(s.next()?.id).toBe('co-1'); // change orders jump ahead
    expect(s.next()?.id).toBe('leaf-b');
  });

  it('serializes the change-order lane', () => {
    const s = new Scheduler([t('co-1', 'change-order', [], 0), t('co-2', 'change-order', [], 0), t('l1', 'leaf')]);
    expect(s.next()?.id).toBe('co-1');
    expect(s.next()?.id).toBe('l1'); // co-2 waits while co-1 is in flight
    expect(s.next()).toBeNull();
    s.finish('co-1', 'landed');
    expect(s.next()?.id).toBe('co-2');
  });

  it('runs a trap after the in-scope tasks it would break (except its own dependents)', () => {
    const trap = { ...t('trap', 'trap'), breaks: ['v1', 'v2', 'dep', 'out-of-scope'] };
    const s = new Scheduler([trap, t('v1', 'leaf'), t('v2', 'leaf'), t('dep', 'leaf', ['trap'])]);
    expect(s.next()?.id).toBe('v1');
    expect(s.next()?.id).toBe('v2');
    expect(s.next()).toBeNull();
    s.finish('v1', 'landed');
    s.finish('v2', 'failed');
    expect(s.next()?.id).toBe('trap');
  });

  it('blocks dependents of failed tasks transitively', () => {
    const s = new Scheduler([t('h', 'helper'), t('a', 'leaf', ['h']), t('b', 'leaf', ['a'])]);
    s.next();
    s.finish('h', 'failed');
    expect(s.counts()).toMatchObject({ failed: 1, blocked: 2 });
    expect(s.next()).toBeNull();
  });
});

describe('runSwarm', () => {
  it('keeps at most N in flight and finishes everything, releasing held change orders at the end', async () => {
    const tasks = [t('h', 'helper'), ...Array.from({ length: 6 }, (_, i) => t(`l${i}`, 'leaf', i % 2 ? ['h'] : [])), t('co', 'change-order', [], 2)];
    let inflight = 0;
    let peak = 0;
    const order: string[] = [];
    const events: RunEvent[] = [];
    const summary = await runSwarm({
      runId: 'r',
      strategy: 'live-main',
      tasks,
      concurrency: 3,
      emit: (e) => void events.push(e),
      runTask: async ({ task }) => {
        inflight++;
        peak = Math.max(peak, inflight);
        await new Promise((r) => setTimeout(r, 2));
        inflight--;
        order.push(task.id);
        return 'landed';
      },
    });
    expect(peak).toBe(3);
    expect(summary.counts.landed).toBe(8);
    expect(order.at(-1)).toBe('co');
    expect(events.some((e) => e.type === 'change-order.released')).toBe(true);
  });
});

describe('metrics', () => {
  it('computes waste, regressions and time to all-green from events', () => {
    const ev: RunEvent[] = [
      { type: 'run.started', runId: 'r', strategy: 'push-to-branch', agents: 2, tasks: 2, at: 0 },
      { type: 'ci', version: 1, sha: 's1', passed: 0, failed: 2, failing: ['A', 'B'], at: 1000 },
      { type: 'task.started', agentId: 'a1', taskId: 'A', at: 0 },
      { type: 'task.started', agentId: 'a2', taskId: 'B', at: 0 },
      { type: 'promotion.rejected', agentId: 'a2', reason: 'push-rejected', paths: [], at: 60_000 },
      { type: 'landed', version: 2, sha: 's2', agentId: 'a1', taskId: 'A', paths: ['x'], merged: 0, at: 60_000 },
      { type: 'task.finished', agentId: 'a1', taskId: 'A', outcome: 'landed', at: 60_000 },
      { type: 'ci', version: 2, sha: 's2', passed: 1, failed: 1, failing: ['B'], at: 61_000 },
      { type: 'rebase', agentId: 'a2', conflicts: 1, at: 70_000 },
      { type: 'landed', version: 3, sha: 's3', agentId: 'a2', taskId: 'B', paths: ['x'], merged: 0, at: 120_000 },
      { type: 'task.finished', agentId: 'a2', taskId: 'B', outcome: 'landed', at: 120_000 },
      { type: 'ci', version: 3, sha: 's3', passed: 1, failed: 1, failing: ['A'], at: 121_000 },
      { type: 'run.finished', runId: 'r', at: 125_000 },
    ];
    const m = computeMetrics(ev);
    expect(m.landed).toBe(2);
    expect(m.agentMinutes).toBeCloseTo(3);
    expect(m.wastedAgentMinutes).toBeCloseTo(1);
    expect(m.regressions).toBe(1); // A was green at v2, red at v3
    expect(m.timeToAllGreenSeconds).toBeNull();
    expect(m.rebases).toBe(1);
    expect(scoreboard([m])).toContain('| breakages that landed (regressions) | 1 |');
  });
});

describe('selectTasks', () => {
  it('is dependency-closed and prefers leaves affected by chosen contract changes', async () => {
    const { selectTasks } = await import('../src/select.js');
    const bank: Task[] = [
      t('h1', 'helper'),
      t('h2', 'helper'),
      ...Array.from({ length: 16 }, (_, i) => t(`l${i}`, 'leaf', i === 15 ? ['h2'] : [])),
      { ...t('co-1', 'change-order', [], 0.3), breaks: ['l12'] },
      { ...t('trap-1', 'trap'), breaks: ['l15'] },
    ];
    const sel = selectTasks(bank, 10);
    const ids = new Set(sel.map((x) => x.id));
    for (const x of sel) for (const d of x.dependsOn) expect(ids.has(d)).toBe(true);
    expect(ids.has('l12')).toBe(true);
    expect(ids.has('l15') && ids.has('h2')).toBe(true);
    expect(sel.length).toBeGreaterThanOrEqual(8);
    expect(sel.length).toBeLessThanOrEqual(13);
  });
});

describe('runSwarm gate', () => {
  it('pauses launching while the gate is pending and stops launching on stop', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => t(`l${i}`, 'leaf'));
    let release: ((v: 'go' | 'stop') => void) | null = null;
    let launches = 0;
    const started: string[] = [];
    const summary = runSwarm({
      runId: 'g',
      strategy: 'live-main',
      tasks,
      concurrency: 1,
      emit: () => undefined,
      gate: () => {
        launches++;
        if (launches === 2) return new Promise((r) => (release = r)); // pause before the second task
        return Promise.resolve(launches >= 3 ? 'stop' : 'go');
      },
      runTask: async ({ task }) => {
        started.push(task.id);
        return 'landed';
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(started).toEqual(['l0']); // paused
    release!('go');
    const s = await summary;
    expect(started).toEqual(['l0', 'l1']); // resumed once, then stopped
    expect(s.counts.landed).toBe(2);
    expect(s.counts.pending).toBe(3);
  });
});
