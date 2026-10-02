import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { Coordinator, handleCoordinatorRequest, json, type Integrator } from '@livemain/core';
import { nodeSqlStore } from '@livemain/core/node';
import type { RunEvent, StrategyName } from '@livemain/protocol';

export interface RunHandle {
  runId: string;
  strategy: StrategyName;
  coord: Coordinator;
  createdAt: number;
  close(): void;
}

type Listener = (runId: string, seq: number, event: RunEvent) => void;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

/**
 * Local stand-in for the Cloudflare edge: one Coordinator per run (the Durable Object
 * equivalent), the same /runs/:id/api routes, and the dashboard's static files.
 */
export class Hub {
  private readonly runs = new Map<string, RunHandle>();
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly dataDir: string,
    private readonly staticDir: string | null,
  ) {
    mkdirSync(dataDir, { recursive: true });
  }

  createRun(runId: string, strategy: StrategyName, integrator: Integrator, remote: string): RunHandle {
    if (this.runs.has(runId)) throw new Error(`run ${runId} exists`);
    const sql = nodeSqlStore(join(this.dataDir, `${runId}.sqlite`));
    const coord = new Coordinator({
      sql,
      integrator,
      remote,
      publish: (event, seq) => {
        for (const l of this.listeners) l(runId, seq, event);
      },
    });
    const handle: RunHandle = { runId, strategy, coord, createdAt: Date.now(), close: () => sql.close() };
    this.runs.set(runId, handle);
    return handle;
  }

  run(runId: string): RunHandle | undefined {
    return this.runs.get(runId);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/runs') {
      return json({
        runs: [...this.runs.values()].map((r) => ({ runId: r.runId, strategy: r.strategy, createdAt: r.createdAt, state: r.coord.stats() })),
      });
    }
    const m = /^\/runs\/([^/]+)(\/api\/.*)$/.exec(url.pathname);
    if (m) {
      const run = this.runs.get(decodeURIComponent(m[1]!));
      if (!run) return json({ error: 'not-found', message: `no run ${m[1]}` }, 404);
      const inner = new URL(request.url);
      inner.pathname = m[2]!;
      return handleCoordinatorRequest(run.coord, new Request(inner, request));
    }
    return this.serveStatic(url.pathname);
  }

  private serveStatic(pathname: string): Response {
    if (!this.staticDir) return json({ error: 'not-found' }, 404);
    const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
    let file = join(this.staticDir, rel);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(this.staticDir, 'index.html');
    if (!existsSync(file)) return json({ error: 'not-found' }, 404);
    return new Response(readFileSync(file), { headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' } });
  }
}
