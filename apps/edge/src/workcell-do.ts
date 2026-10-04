import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env.js';

const PORT = 8080;

export type WorkcellRole = 'workcell' | 'integrator';

/**
 * Hosts one workcell container (FUSE overlays + test runner) or the integrator.
 * The `durable_object` scheduling policy gives container processes root capabilities,
 * which the FUSE mounts need. Requests to this DO are proxied to the container's
 * control API (docs/workcell-api.md).
 *
 * The role is the prefix of the DO name: `integrator:<run>` or `workcell:<run>:<i>`.
 */
export class Workcell extends DurableObject<Env> {
  private starting: Promise<void> | null = null;

  override async fetch(request: Request): Promise<Response> {
    const role = (request.headers.get('x-livemain-role') as WorkcellRole | null) ?? 'workcell';
    await this.ensureRunning(role);
    const url = new URL(request.url);
    const port = this.container().getTcpPort(PORT);
    return port.fetch(`http://container${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    });
  }

  private container() {
    const c = this.ctx.container;
    if (!c) throw new Error('Workcell DO has no container configured');
    return c;
  }

  private ensureRunning(role: WorkcellRole): Promise<void> {
    if (this.container().running && !this.starting) return Promise.resolve();
    this.starting ??= this.start(role).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async start(role: WorkcellRole): Promise<void> {
    const c = this.container();
    if (!c.running) {
      c.start({
        image: c.images.workcell,
        // Workcells fetch from / push to Artifacts over HTTPS.
        enableInternet: true,
        // The image's default command is `workcell serve --listen :8080`; the role comes from env.
        env: { LIVEMAIN_DATA: '/var/livemain', LIVEMAIN_ROLE: role },
        instance: role === 'integrator' ? 'standard-3' : 'standard-2',
      });
    }
    const port = c.getTcpPort(PORT);
    let last: unknown;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const res = await port.fetch('http://container/health');
        // Always drain the body: an unread response keeps its connection open.
        await res.arrayBuffer();
        if (res.ok) {
          await c.setInactivityTimeout(30 * 60 * 1000);
          return;
        }
        last = new Error(`health ${res.status}`);
      } catch (err) {
        last = err;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`workcell container did not become ready: ${String(last)}`);
  }
}
