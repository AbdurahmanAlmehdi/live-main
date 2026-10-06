/** Git pkt-line framing (gitprotocol-common): 4 hex digits of length, then the payload; 0000 is a flush. */

const enc = new TextEncoder();
const dec = new TextDecoder();

export type Pkt = { kind: 'data'; bytes: Uint8Array } | { kind: 'flush' } | { kind: 'delim' };

export function pkt(payload: string | Uint8Array): Uint8Array<ArrayBuffer> {
  const body = typeof payload === 'string' ? enc.encode(payload) : payload;
  const out = new Uint8Array(body.length + 4);
  out.set(enc.encode((body.length + 4).toString(16).padStart(4, '0')));
  out.set(body, 4);
  return out;
}

export const FLUSH: Uint8Array<ArrayBuffer> = new Uint8Array(enc.encode('0000'));

/** Reads pkt-lines from `buf` starting at `pos`, up to the end or the first packet `until` accepts. */
export function readPkts(buf: Uint8Array, pos = 0, until: (p: Pkt) => boolean = () => false): { pkts: Pkt[]; pos: number } {
  const pkts: Pkt[] = [];
  while (pos + 4 <= buf.length) {
    const len = parseInt(dec.decode(buf.subarray(pos, pos + 4)), 16);
    if (Number.isNaN(len)) throw new Error('malformed pkt-line');
    let p: Pkt;
    if (len === 0) p = { kind: 'flush' };
    else if (len === 1) p = { kind: 'delim' };
    else {
      if (len < 4 || pos + len > buf.length) throw new Error('truncated pkt-line');
      p = { kind: 'data', bytes: buf.subarray(pos + 4, pos + len) };
    }
    pos += len === 0 || len === 1 ? 4 : len;
    pkts.push(p);
    if (until(p)) break;
  }
  return { pkts, pos };
}

export function text(p: Pkt): string {
  return p.kind === 'data' ? dec.decode(p.bytes).replace(/\n$/, '') : '';
}

export function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Side-band-64k: data on band 1, progress on band 2 (shown by git as `remote: …`). */
export function band(n: 1 | 2 | 3, payload: string | Uint8Array): Uint8Array<ArrayBuffer> {
  const body = typeof payload === 'string' ? enc.encode(payload) : payload;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < body.length || i === 0; i += 65515) {
    chunks.push(pkt(concat([Uint8Array.of(n), body.subarray(i, i + 65515)])));
    if (body.length === 0) break;
  }
  return concat(chunks);
}

/** The band-1 bytes of a side-band response (progress and errors are dropped). */
export function demux(buf: Uint8Array): Uint8Array<ArrayBuffer> {
  const out: Uint8Array[] = [];
  for (const p of readPkts(buf).pkts) if (p.kind === 'data' && p.bytes[0] === 1) out.push(p.bytes.subarray(1));
  return concat(out);
}
