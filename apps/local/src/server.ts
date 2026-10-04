import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { REPO_PATH, type V1Api } from '@livemain/api';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Hub } from './hub.js';

type FetchHandler = (request: Request) => Promise<Response | null>;

/** API v1: its fetch handler, and the API itself for live repo events over WebSocket. */
export interface V1Server {
  handle: FetchHandler;
  api: V1Api;
}

/**
 * HTTP + WebSocket front for the hub. WebSocket clients connect to /runs/:id/ws and
 * receive `{ seq, event }` messages; on connect they get the backlog after `?after=`.
 * `api` (the /v1 router) answers first when given; responses stream (SSE).
 */
export function startServer(hub: Hub, port: number, v1?: V1Server): Promise<Server> {
  const handle: FetchHandler = async (request) => (v1 ? await v1.handle(request) : null) ?? hub.handle(request);
  const server = createServer((req, res) => {
    void toFetch(handle, req, res);
  });
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Map<string, Set<WebSocket>>();

  hub.subscribe((runId, seq, event) => {
    const set = sockets.get(runId);
    if (!set) return;
    const msg = JSON.stringify({ seq, event });
    for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // Live repo events: /v1/repos/:owner/:name/events (a hibernating WebSocket on the RepoDO on Cloudflare).
    const repoEvents = v1 ? REPO_PATH.exec(url.pathname) : null;
    if (v1 && repoEvents && repoEvents[3] === '/events') {
      v1.api
        .repo(decodeURIComponent(repoEvents[1]!), decodeURIComponent(repoEvents[2]!))
        .then((repo) =>
          wss.handleUpgrade(req, socket, head, (ws) => {
            const off = repo.subscribe((e) => {
              if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(e));
            });
            ws.on('close', off);
          }),
        )
        .catch(() => socket.destroy());
      return;
    }
    const m = /^\/runs\/([^/]+)\/ws$/.exec(url.pathname);
    const run = m ? hub.run(decodeURIComponent(m[1]!)) : undefined;
    if (!run) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const set = sockets.get(run.runId) ?? new Set<WebSocket>();
      sockets.set(run.runId, set);
      set.add(ws);
      ws.on('close', () => set.delete(ws));
      const after = Number(url.searchParams.get('after') ?? 0);
      for (const { seq, event } of run.coord.events(after, 100_000)) ws.send(JSON.stringify({ seq, event }));
    });
  });

  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function toFetch(handle: FetchHandler, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const request = new Request(new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      signal: abort.signal,
    });
    const response = (await handle(request))!;
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (!response.body) {
      res.end();
      return;
    }
    // Stream (server-sent events stay open until the client goes away).
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done || abort.signal.aborted) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    if (abort.signal.aborted) return;
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal', message: String(err) }));
  }
}
