import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Coordinator, HttpCoordinatorClient, LocalCoordinatorClient, SyntheticIntegrator, type CoordinatorApi } from '@livemain/core';
import { nodeSqlStore } from '@livemain/core/node';
import { renderReport, runSynthetic, type SynthOptions } from './swarm.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

/**
 * Usage:
 *   pnpm --filter @livemain/synth-swarm start -- --agents 10000 --duration 60 --think 5000
 *   ... --transport inproc            coordinator in this process (default)
 *   ... --transport http              coordinator behind the local HTTP API (loopback)
 *   ... --url https://<worker>/runs/<synthetic-run-id>   a deployed coordinator DO created via POST /api/synth-runs
 */
async function main(): Promise<void> {
  const opts: SynthOptions = {
    agents: Number(arg('agents', '1000')),
    durationMs: Number(arg('duration', '30')) * 1000,
    thinkMs: Number(arg('think', '3000')),
    helpers: Number(arg('helpers', '60')),
    pHelperEdit: Number(arg('p-helper', '0.12')),
    pContract: Number(arg('p-contract', '0.01')),
    rampMs: Number(arg('ramp', '5')) * 1000,
    seed: Number(arg('seed', '42')),
  };
  const latency = Number(arg('integrator-ms', '0'));
  const url = arg('url', '');
  const transport = url ? 'url' : arg('transport', 'inproc');
  mkdirSync(join(root, 'bench/runs/.db'), { recursive: true });

  let client: CoordinatorApi;
  let queue = () => 0;
  let close = () => undefined as void;
  if (transport === 'url') {
    client = new HttpCoordinatorClient(url);
  } else {
    const sql = nodeSqlStore(join(root, `bench/runs/.db/synth-${Date.now()}.sqlite`));
    const coord = new Coordinator({ sql, integrator: new SyntheticIntegrator('synth-seed', latency), remote: 'synthetic' });
    coord.init('synth-seed');
    queue = () => coord.queueLength;
    if (transport === 'http') {
      const { Hub } = await import('../../../apps/local/src/hub.js');
      const { startServer } = await import('../../../apps/local/src/server.js');
      const hub = new Hub(join(root, 'bench/runs/.db'), null);
      const run = hub.createRun(`synth-${Date.now()}`, 'live-main', new SyntheticIntegrator('synth-seed', latency), 'synthetic');
      run.coord.init('synth-seed');
      queue = () => run.coord.queueLength;
      const server = await startServer(hub, 0);
      const port = (server.address() as { port: number }).port;
      client = new HttpCoordinatorClient(`http://127.0.0.1:${port}/runs/${run.runId}`);
      close = () => void server.close();
    } else {
      client = new LocalCoordinatorClient(coord);
    }
    const prev = close;
    close = () => {
      prev();
      sql.close();
    };
  }

  console.log(`synthetic swarm: ${opts.agents} agents for ${opts.durationMs / 1000}s via ${transport}`);
  const report = await runSynthetic(client, opts, transport, queue);
  close();
  const md = renderReport(report);
  console.log(`\n${md}\n`);
  const file = join(root, 'bench/runs', `synth-${transport}-${opts.agents}-${Date.now()}.md`);
  writeFileSync(file, `${md}\n\n\`\`\`json\n${JSON.stringify(report.options)}\n\`\`\`\n`);
  console.log(`report → ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
