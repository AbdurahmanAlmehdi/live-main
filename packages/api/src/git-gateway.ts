import { ApiError } from './errors.js';
import { band, concat, demux, FLUSH, pkt, readPkts, text } from './pkt-line.js';
import type { GitHost } from './ports.js';

const ZERO = '0'.repeat(40);
const MAIN = 'refs/heads/main';
/** Capabilities the gateway cannot honour for main (it reports per ref, after promotion). */
const HIDDEN_CAPS = new Set(['report-status-v2', 'atomic', 'push-options']);
const MAX_PUSH = 64 * 1024 * 1024;

/** A push to main, after its objects reached the host under a temporary ref. */
export interface PushedMain {
  person: string;
  /** the client's main before the push (its base) */
  oldSha: string;
  /** the pushed commit */
  newSha: string;
  /** `git push -o change-order` */
  changeOrder: boolean;
}

/** The outcome shown to the pusher: `ok`, or `ng` with a reason, plus `remote:` lines. */
export interface PushReport {
  ok: boolean;
  reason?: string;
  lines: string[];
}

interface Command {
  oldSha: string;
  newSha: string;
  ref: string;
}

/**
 * Smart-HTTP git in front of a repository's host. Fetches and clones pass through. A push to
 * `main` is redirected to a temporary ref and then promoted through Live Main (the same rule,
 * impact tests and notices as an agent's landing); other refs pass through unchanged.
 */
export class GitGateway {
  constructor(
    private readonly d: {
      git: GitHost;
      repo: string;
      promote(push: PushedMain): Promise<PushReport>;
      /** a person fetched: remember the main they now have */
      fetched(person: string): void;
      /** the main a person last fetched (advertised to them as main when they push) */
      lastFetched(person: string): string | null;
      newId?: () => string;
    },
  ) {}

  async handle(req: Request, rest: string, person: string): Promise<Response> {
    const host = this.d.git.smartHttp?.bind(this.d.git);
    if (!host) throw new ApiError(501, 'no-git-gateway', 'This repository host does not serve git over HTTP.');
    const url = new URL(req.url);
    const service = url.searchParams.get('service');
    if (service === 'git-upload-pack' || rest === '/git-upload-pack') this.d.fetched(person);
    if (req.method === 'GET' && rest === '/info/refs' && service === 'git-upload-pack') {
      return passThrough(await host(this.d.repo, 'read', `/info/refs?service=git-upload-pack`, { headers: gitHeaders(req, true) }));
    }
    if (req.method === 'POST' && rest === '/git-upload-pack') {
      // Buffered: negotiation bodies are small, and some git backends refuse chunked uploads.
      return passThrough(await host(this.d.repo, 'read', '/git-upload-pack', { method: 'POST', headers: gitHeaders(req, true), body: await req.arrayBuffer() }));
    }
    if (req.method === 'GET' && rest === '/info/refs' && service === 'git-receive-pack') {
      const res = await host(this.d.repo, 'write', `/info/refs?service=git-receive-pack`, { headers: gitHeaders(req, false) });
      if (!res.ok) return passThrough(res);
      const main = this.d.lastFetched(person);
      return new Response(advertise(new Uint8Array(await res.arrayBuffer()), main), { headers: noCache('application/x-git-receive-pack-advertisement') });
    }
    if (req.method === 'POST' && rest === '/git-receive-pack') return this.receivePack(req, person);
    throw new ApiError(404, 'not-found', `no git endpoint ${req.method} ${rest}`);
  }

  private async receivePack(req: Request, person: string): Promise<Response> {
    const body = await readBody(req);
    let { pkts, pos } = readPkts(body, 0, (p) => p.kind === 'flush');
    const commands: Command[] = [];
    let caps: string[] = [];
    for (const p of pkts) {
      if (p.kind !== 'data') continue;
      let line = text(p);
      if (commands.length === 0) {
        const [head, capList = ''] = line.split('\0');
        line = head!;
        caps = capList.split(' ').filter(Boolean);
      }
      const [oldSha, newSha, ref] = line.split(' ');
      if (oldSha && newSha && ref) commands.push({ oldSha, newSha, ref });
    }
    const options: string[] = [];
    if (caps.includes('push-options')) {
      const opt = readPkts(body, pos, (p) => p.kind === 'flush');
      options.push(...opt.pkts.filter((p) => p.kind === 'data').map(text));
      pos = opt.pos;
    }
    const pack = body.subarray(pos);
    const sideband = caps.includes('side-band-64k');

    // main never moves by a plain push: its objects go to a temporary ref, then get promoted.
    const pushRef = `refs/heads/push/${this.d.newId?.() ?? Date.now().toString(36)}`;
    const main = commands.find((c) => c.ref === MAIN);
    const statuses = new Map<string, string>();
    const progress: string[] = [];
    if (main?.newSha === ZERO) statuses.set(MAIN, 'ng refs/heads/main deleting main is not allowed');
    const forward = commands.filter((c) => !statuses.has(c.ref)).map((c) => (c.ref === MAIN ? { oldSha: ZERO, newSha: c.newSha, ref: pushRef } : c));

    if (forward.length > 0) {
      const upstreamCaps = caps.filter((c) => !HIDDEN_CAPS.has(c));
      const lines = forward.map((c, i) => pkt(`${c.oldSha} ${c.newSha} ${c.ref}${i === 0 ? `\0${upstreamCaps.join(' ')}` : ''}\n`));
      const res = await this.d.git.smartHttp!(this.d.repo, 'write', '/git-receive-pack', {
        method: 'POST',
        headers: { 'content-type': 'application/x-git-receive-pack-request', accept: 'application/x-git-receive-pack-result' },
        body: concat([...lines, FLUSH, pack]),
      });
      if (!res.ok) return passThrough(res);
      const raw = new Uint8Array(await res.arrayBuffer());
      const report = readPkts(sideband ? demux(raw) : raw).pkts.map(text);
      const unpack = report.find((l) => l.startsWith('unpack '));
      if (unpack && unpack !== 'unpack ok') return this.respond(sideband, unpack, commands.map((c) => `ng ${c.ref} ${unpack}`), progress);
      for (const line of report) {
        const m = /^(ok|ng) (\S+)(?: (.*))?$/.exec(line);
        if (!m) continue;
        const ref = m[2] === pushRef ? MAIN : m[2]!;
        statuses.set(ref, m[1] === 'ok' ? `ok ${ref}` : `ng ${ref} ${m[3] ?? 'rejected'}`);
      }
    }

    if (main && statuses.get(MAIN) === `ok ${MAIN}`) {
      try {
        const r = await this.d.promote({ person, oldSha: main.oldSha, newSha: main.newSha, changeOrder: options.includes('change-order') });
        progress.push(...r.lines);
        statuses.set(MAIN, r.ok ? `ok ${MAIN}` : `ng ${MAIN} ${r.reason ?? 'rejected by Live Main'}`);
      } catch (err) {
        statuses.set(MAIN, `ng ${MAIN} Live Main could not promote this push: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await this.deleteRef(pushRef, main.newSha).catch(() => undefined);
      }
    }
    return this.respond(sideband, 'unpack ok', commands.map((c) => statuses.get(c.ref) ?? `ng ${c.ref} not processed`), progress);
  }

  /** report-status for the client, with progress as `remote:` lines when it asked for side-band. */
  private respond(sideband: boolean, unpack: string, statuses: string[], progress: string[]): Response {
    const report = concat([pkt(`${unpack}\n`), ...statuses.map((s) => pkt(`${s}\n`)), FLUSH]);
    const body = sideband ? concat([...progress.map((l) => band(2, `${l}\n`)), band(1, report), FLUSH]) : report;
    return new Response(body, { headers: noCache('application/x-git-receive-pack-result') });
  }

  private async deleteRef(ref: string, sha: string): Promise<void> {
    const res = await this.d.git.smartHttp!(this.d.repo, 'write', '/git-receive-pack', {
      method: 'POST',
      headers: { 'content-type': 'application/x-git-receive-pack-request' },
      body: concat([pkt(`${sha} ${ZERO} ${ref}\0report-status delete-refs\n`), FLUSH]),
    });
    await res.arrayBuffer();
  }
}

/**
 * The receive-pack advertisement for one person. `main` is shown at the version they last
 * fetched (or not at all), never at a newer one they lack: git would refuse with "fetch first",
 * while Live Main merges a push made on an older main by the promotion rule. Temporary push
 * refs are hidden, and capabilities the gateway handles itself are adjusted.
 */
function advertise(buf: Uint8Array, main: string | null): Uint8Array<ArrayBuffer> {
  const { pkts } = readPkts(buf);
  const service: Uint8Array[] = [];
  const refs: { sha: string; ref: string }[] = [];
  let caps: string[] = [];
  let seenService = false;
  for (const p of pkts) {
    if (p.kind !== 'data') continue;
    const line = text(p);
    if (!seenService && line.startsWith('# service=')) {
      seenService = true;
      service.push(pkt(`${line}\n`), FLUSH);
      continue;
    }
    const [head, capList] = line.split('\0');
    if (capList !== undefined) caps = capList.split(' ').filter((c) => c && !HIDDEN_CAPS.has(c));
    const [sha, ref] = head!.split(' ');
    if (!sha || !ref || ref === 'capabilities^{}' || ref.startsWith('refs/heads/push/')) continue;
    if (ref === MAIN) {
      if (main) refs.push({ sha: main, ref });
    } else refs.push({ sha, ref });
  }
  const capText = [...caps, 'push-options'].join(' ');
  const lines = refs.length > 0 ? refs.map((r, i) => pkt(`${r.sha} ${r.ref}${i === 0 ? `\0${capText}` : ''}\n`)) : [pkt(`${ZERO} capabilities^{}\0${capText}\n`)];
  return concat([...service, ...lines, FLUSH]);
}

async function readBody(req: Request): Promise<Uint8Array> {
  let stream = req.body;
  if (!stream) return new Uint8Array();
  if (req.headers.get('content-encoding') === 'gzip') stream = stream.pipeThrough(new DecompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  if (buf.length > MAX_PUSH) throw new ApiError(413, 'push-too-large', 'Pushes are limited to 64 MB.');
  return buf;
}

function gitHeaders(req: Request, fetchSide: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  for (const k of ['content-type', 'accept', 'content-encoding', 'user-agent']) {
    const v = req.headers.get(k);
    if (v) h[k] = v;
  }
  // Protocol v2 for fetches; pushes stay on v0, whose report the gateway rewrites.
  const proto = req.headers.get('git-protocol');
  if (fetchSide && proto) h['git-protocol'] = proto;
  return h;
}

function passThrough(res: Response): Response {
  const headers = new Headers();
  for (const k of ['content-type', 'content-encoding', 'cache-control']) {
    const v = res.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers });
}

function noCache(type: string): HeadersInit {
  return { 'content-type': type, 'cache-control': 'no-cache' };
}
