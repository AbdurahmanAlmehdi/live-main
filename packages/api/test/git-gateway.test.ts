import { describe, expect, it } from 'vitest';
import { GitGateway, type GitHost, type PushedMain } from '../src/index.js';
import { band, concat, demux, FLUSH, pkt, readPkts, text } from '../src/pkt-line.js';

const MAIN = 'a'.repeat(40);
const FETCHED = 'b'.repeat(40);
const PUSHED = 'c'.repeat(40);
const ZERO = '0'.repeat(40);

/** A host whose smart-HTTP answers are canned; records what the gateway sends upstream. */
function fakeHost() {
  const sent: { path: string; body: Uint8Array }[] = [];
  const host: Pick<GitHost, 'smartHttp'> = {
    async smartHttp(_name, _access, path, init) {
      const body = init?.body ? new Uint8Array(init.body as ArrayBuffer) : new Uint8Array();
      sent.push({ path, body });
      if (path.startsWith('/info/refs')) {
        return new Response(
          concat([
            pkt('# service=git-receive-pack\n'),
            FLUSH,
            pkt(`${MAIN} refs/heads/main\0report-status report-status-v2 side-band-64k atomic delete-refs ofs-delta\n`),
            pkt(`${'d'.repeat(40)} refs/heads/push/old\n`),
            pkt(`${'e'.repeat(40)} refs/heads/overlay/agent-1\n`),
            FLUSH,
          ]),
        );
      }
      // receive-pack: accept every command, on side-band only when asked (like git)
      const lines = readPkts(body, 0, (p) => p.kind === 'flush').pkts.filter((p) => p.kind === 'data').map(text);
      const report = concat([pkt('unpack ok\n'), ...lines.map((l) => pkt(`ok ${l.split('\0')[0]!.split(' ')[2]}\n`)), FLUSH]);
      return new Response(lines[0]?.includes('side-band-64k') ? concat([band(1, report), FLUSH]) : report);
    },
  };
  return { host: host as GitHost, sent };
}

describe('GitGateway', () => {
  it('advertises main at the version the person last fetched, hides push refs, adds push-options', async () => {
    const { host } = fakeHost();
    const gw = new GitGateway({ git: host, repo: 'r', promote: async () => ({ ok: true, lines: [] }), fetched: () => undefined, lastFetched: () => FETCHED });
    const res = await gw.handle(new Request('http://x/info/refs?service=git-receive-pack'), '/info/refs', 'lina');
    const lines = readPkts(new Uint8Array(await res.arrayBuffer())).pkts.filter((p) => p.kind === 'data').map(text);
    expect(lines[0]).toBe('# service=git-receive-pack');
    expect(lines[1]).toBe(`${FETCHED} refs/heads/main\0report-status side-band-64k delete-refs ofs-delta push-options`);
    expect(lines.slice(2)).toEqual([`${'e'.repeat(40)} refs/heads/overlay/agent-1`]);
  });

  it('lands a push to main through promotion and reports it with remote: lines', async () => {
    const { host, sent } = fakeHost();
    const pushes: PushedMain[] = [];
    const gw = new GitGateway({
      git: host,
      repo: 'r',
      newId: () => 'p1',
      fetched: () => undefined,
      lastFetched: () => FETCHED,
      promote: async (p) => {
        pushes.push(p);
        return { ok: true, lines: ['Live Main: landed as v7'] };
      },
    });
    const body = concat([
      pkt(`${FETCHED} ${PUSHED} refs/heads/main\0report-status side-band-64k push-options agent=git/2\n`),
      FLUSH,
      pkt('change-order\n'),
      FLUSH,
      new TextEncoder().encode('PACK....'),
    ]);
    const res = await gw.handle(new Request('http://x/git-receive-pack', { method: 'POST', body }), '/git-receive-pack', 'lina');
    expect(pushes).toEqual([{ person: 'lina', oldSha: FETCHED, newSha: PUSHED, changeOrder: true }]);

    // upstream got the objects under a temporary ref (no push options), then its deletion
    const forwarded = sent.find((s) => s.path === '/git-receive-pack')!;
    const first = text(readPkts(forwarded.body, 0, (p) => p.kind === 'flush').pkts[0]!);
    expect(first).toBe(`${ZERO} ${PUSHED} refs/heads/push/p1\0report-status side-band-64k agent=git/2`);
    expect(new TextDecoder().decode(forwarded.body)).toContain('PACK....');
    expect(text(readPkts(sent.at(-1)!.body, 0, (p) => p.kind === 'flush').pkts[0]!)).toMatch(new RegExp(`^${PUSHED} ${ZERO} refs/heads/push/p1\0`));

    const raw = new Uint8Array(await res.arrayBuffer());
    const progress = readPkts(raw).pkts.filter((p) => p.kind === 'data' && p.bytes[0] === 2).map((p) => new TextDecoder().decode(p.kind === 'data' ? p.bytes.subarray(1) : new Uint8Array()));
    expect(progress).toEqual(['Live Main: landed as v7\n']);
    expect(readPkts(demux(raw)).pkts.filter((p) => p.kind === 'data').map(text)).toEqual(['unpack ok', 'ok refs/heads/main']);
  });

  it('refuses a push with the promotion reason, and refuses deleting main', async () => {
    const { host } = fakeHost();
    const gw = new GitGateway({ git: host, repo: 'r', fetched: () => undefined, lastFetched: () => null, promote: async () => ({ ok: false, reason: 'breaks tests already on main', lines: [] }) });
    const report = async (cmd: string) => {
      const res = await gw.handle(new Request('http://x/git-receive-pack', { method: 'POST', body: concat([pkt(`${cmd}\0report-status\n`), FLUSH]) }), '/git-receive-pack', 'lina');
      return readPkts(new Uint8Array(await res.arrayBuffer())).pkts.filter((p) => p.kind === 'data').map(text);
    };
    expect(await report(`${FETCHED} ${PUSHED} refs/heads/main`)).toEqual(['unpack ok', 'ng refs/heads/main breaks tests already on main']);
    expect(await report(`${FETCHED} ${ZERO} refs/heads/main`)).toEqual(['unpack ok', 'ng refs/heads/main deleting main is not allowed']);
  });
});
