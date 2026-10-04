import { DurableObject } from 'cloudflare:workers';
import { Coordinator, handleCoordinatorRequest, json, SyntheticIntegrator } from '@livemain/core';
import { integratorName, workcellClient } from './clients.js';
import { doSqlStore } from './do-sql.js';
import type { Env } from './env.js';

interface CoordinatorConfig {
  runId: string;
  remote: string;
  /** synthetic stress test: no git behind the integrator (results are labeled synthetic) */
  synthetic?: boolean;
}

/**
 * One Live Main coordinator per run: the single writer of main. SQLite-backed (versions,
 * overlays, read-set index, notices, events), WebSocket fan-out with hibernation for the
 * dashboard, and the integrator container as its git hands.
 */
export class CoordinatorDO extends DurableObject<Env> {
  private coord: Coordinator | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const cfg = await ctx.storage.get<CoordinatorConfig>('config');
      if (cfg) this.coord = this.build(cfg);
    });
  }

  private build(cfg: CoordinatorConfig): Coordinator {
    return new Coordinator({
      sql: doSqlStore(this.ctx.storage),
      integrator: cfg.synthetic ? new SyntheticIntegrator(null) : workcellClient(this.env, integratorName(cfg.runId), 'integrator'),
      remote: cfg.remote,
      publish: (event, seq) => {
        const msg = JSON.stringify({ seq, event });
        for (const ws of this.ctx.getWebSockets()) {
          try {
            ws.send(msg);
          } catch {
            // closed socket; the runtime cleans it up
          }
        }
      },
    });
  }

  /** RPC: bind this coordinator to a run and its main repo. */
  async configure(cfg: CoordinatorConfig): Promise<void> {
    await this.ctx.storage.put('config', cfg);
    this.coord = this.build(cfg);
  }

  override async fetch(request: Request): Promise<Response> {
    if (!this.coord) return json({ error: 'not-configured', message: 'run not started' }, 409);
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server);
      const after = Number(url.searchParams.get('after') ?? 0);
      for (const { seq, event } of this.coord.events(after, 100_000)) server.send(JSON.stringify({ seq, event }));
      return new Response(null, { status: 101, webSocket: client });
    }
    return handleCoordinatorRequest(this.coord, request);
  }

  override async webSocketMessage(): Promise<void> {
    // Dashboard sockets are receive-only.
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    ws.close(code, 'closing');
  }
}
