import { mkdtempSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpCoordinatorClient, SyntheticIntegrator } from '@livemain/core';
import { afterAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Hub } from '../src/hub.js';
import { startServer } from '../src/server.js';

const dir = mkdtempSync(join(tmpdir(), 'livemain-hub-'));
const hub = new Hub(dir, null);
const run = hub.createRun('r1', 'live-main', new SyntheticIntegrator('seed'), 'synthetic');
run.coord.init('seed');
const serverP = startServer(hub, 0);

afterAll(async () => {
  (await serverP).close();
  run.close();
});

describe('local hub', () => {
  it('serves the coordinator API per run and lists runs', async () => {
    const port = ((await serverP).address() as AddressInfo).port;
    const client = new HttpCoordinatorClient(`http://127.0.0.1:${port}/runs/r1`);
    expect(await client.head()).toEqual({ version: 1, sha: 'seed' });
    await client.register({ agentId: 'a', taskId: 't', strategy: 'live-main', workcell: 'w' });
    const res = await client.promote({
      agentId: 'a',
      pin: 1,
      readSet: [],
      writeSet: ['x.ts'],
      changes: [{ path: 'x.ts', content: '// synth:additive\n' }],
      testsRun: [],
      message: 'x',
    });
    expect(res).toMatchObject({ status: 'landed', version: 2 });
    const list = (await (await fetch(`http://127.0.0.1:${port}/api/runs`)).json()) as { runs: { runId: string }[] };
    expect(list.runs.map((r) => r.runId)).toEqual(['r1']);
    const missing = await fetch(`http://127.0.0.1:${port}/runs/nope/api/head`);
    expect(missing.status).toBe(404);
  });

  it('streams backlog then live events over WebSocket', async () => {
    const port = ((await serverP).address() as AddressInfo).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/runs/r1/ws?after=0`);
    const got: string[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        const { event } = JSON.parse(String(data)) as { event: { type: string } };
        got.push(event.type);
        if (event.type === 'ci') resolve();
      });
      ws.on('open', () => run.coord.recordCi(2, 'x', { passed: 1, failed: 0, files: [] }));
      ws.on('error', reject);
    });
    ws.close();
    expect(got).toContain('landed'); // backlog
    expect(got.at(-1)).toBe('ci'); // live
  });
});
