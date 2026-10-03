import type { OverlayState, TaskBank } from '@livemain/protocol';
import type { ConnState, RunListing, RunSource, SeqEvent, SourceHandlers } from './types.js';

const POLL_MS = 1000;
const OVERLAY_MS = 2000;
const PAGE = 1000;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function listRuns(): Promise<RunListing[]> {
  return (await getJson<{ runs: RunListing[] }>('/api/runs')).runs;
}

export async function loadTaskBank(): Promise<TaskBank> {
  return getJson<TaskBank>('/bench/tasks.json');
}

/**
 * Live event stream for one run: WebSocket first (backlog then live), polling /api/events
 * every second while the socket is down, and reconnects with backoff. Overlays are polled.
 */
export class LiveSource implements RunSource {
  private ws: WebSocket | null = null;
  private lastSeq = 0;
  private closed = false;
  private backoff = 1000;
  private pollTimer: number | null = null;
  private overlayTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private polling = false;
  private h: SourceHandlers | null = null;

  constructor(readonly runId: string) {}

  now(): number {
    return Date.now();
  }

  connect(handlers: SourceHandlers): void {
    this.h = handlers;
    handlers.status('connecting');
    this.openSocket();
    void this.pollOverlays();
    this.overlayTimer = window.setInterval(() => void this.pollOverlays(), OVERLAY_MS);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    for (const t of [this.pollTimer, this.overlayTimer]) if (t !== null) window.clearInterval(t);
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
  }

  private base(): string {
    return `/runs/${encodeURIComponent(this.runId)}`;
  }

  private deliver(batch: SeqEvent[]): void {
    const fresh = batch.filter((b) => b.seq > this.lastSeq);
    if (fresh.length === 0) return;
    this.lastSeq = fresh[fresh.length - 1]!.seq;
    this.h?.events(fresh);
  }

  private setStatus(s: ConnState): void {
    this.h?.status(s);
  }

  private openSocket(): void {
    if (this.closed) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}//${location.host}${this.base()}/ws?after=${this.lastSeq}`);
    } catch {
      this.socketDown();
      return;
    }
    this.ws = ws;
    // Backlog arrives as a burst of messages: batch them (timers, not rAF, so hidden tabs keep up).
    let pending: SeqEvent[] = [];
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const batch = pending;
      pending = [];
      this.deliver(batch);
    };
    ws.onopen = () => {
      this.backoff = 1000;
      this.stopPolling();
      this.setStatus('live');
    };
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(String(msg.data)) as SeqEvent;
        if (typeof parsed.seq !== 'number' || !parsed.event) return;
        pending.push(parsed);
        if (!scheduled) {
          scheduled = true;
          window.setTimeout(flush, 40);
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      if (pending.length > 0) flush();
      if (this.ws === ws) this.ws = null;
      this.socketDown();
    };
    ws.onerror = () => ws.close();
  }

  private socketDown(): void {
    if (this.closed) return;
    this.startPolling();
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 15_000);
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    this.setStatus('polling');
    void this.pollEvents();
    this.pollTimer = window.setInterval(() => void this.pollEvents(), POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async pollEvents(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      for (;;) {
        const { events } = await getJson<{ events: SeqEvent[] }>(`${this.base()}/api/events?after=${this.lastSeq}&limit=${PAGE}`);
        this.deliver(events);
        if (events.length < PAGE || this.closed) break;
      }
      if (this.pollTimer !== null) this.setStatus('polling');
    } catch {
      if (this.pollTimer !== null) this.setStatus('offline');
    } finally {
      this.polling = false;
    }
  }

  private async pollOverlays(): Promise<void> {
    try {
      const { overlays } = await getJson<{ overlays: OverlayState[] }>(`${this.base()}/api/overlays?status=active`);
      this.h?.overlays(overlays);
    } catch {
      /* the run may not be configured yet */
    }
  }
}
