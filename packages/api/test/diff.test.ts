import { describe, expect, it } from 'vitest';
import { merge3, overlayPatch } from '../src/diff.js';

const registry = (...fns: string[]) => `export const registry = {\n${fns.map((f) => `  ${f}: () => import('../functions/math/${f}'),\n`).join('')}};\n`;
const lines = (p: ReturnType<typeof overlayPatch>, kind: 'add' | 'del') => p.hunks.flatMap((h) => h.lines.filter((l) => l.kind === kind).map((l) => l.text.trim()));

describe('merge3', () => {
  it('keeps non-overlapping edits from both sides', () => {
    expect(merge3('a\nb\nc\nd\n', 'a\nB\nc\nd\n', 'a\nb\nc\nD\n')).toBe('a\nB\nc\nD\n');
  });

  it('unions insertions at the same anchor, ours first', () => {
    expect(merge3('a\nz\n', 'a\nours\nz\n', 'a\ntheirs\nz\n')).toBe('a\nours\ntheirs\nz\n');
    expect(merge3('a\nz\n', 'a\nsame\nz\n', 'a\nsame\nz\n')).toBe('a\nsame\nz\n');
  });

  it('returns null when both sides change the same lines differently', () => {
    expect(merge3('a\nb\nc\n', 'a\nX\nc\n', 'a\nY\nc\n')).toBeNull();
  });
});

describe('overlayPatch', () => {
  it('is the plain diff against main when main has not moved since the pin', () => {
    const p = overlayPatch('r.ts', registry('MAX'), registry('MAX'), registry('MAX', 'QUOTIENT'), 'additive');
    expect(p).toMatchObject({ added: 1, removed: 0, class: 'additive' });
    expect(p.against).toBeUndefined();
  });

  // Regression: agent "Implement QUOTIENT" pinned before MOD landed; diffing its overlay straight
  // against main showed `- MOD` as if the agent had deleted it.
  it('does not show a concurrent landing as a removal when main moved under the agent', () => {
    const pin = registry('MAX', 'MIN', 'PRODUCT');
    const head = registry('MAX', 'MIN', 'MOD', 'PRODUCT');
    const overlay = registry('MAX', 'MIN', 'PRODUCT', 'QUOTIENT');
    const p = overlayPatch('src/core/registry.ts', pin, head, overlay, 'additive');
    expect(p).toMatchObject({ added: 1, removed: 0, status: 'modified', against: 'rebased' });
    expect(lines(p, 'add')).toEqual(["QUOTIENT: () => import('../functions/math/QUOTIENT'),"]);
    expect(lines(p, 'del')).toEqual([]);
    // hunk line numbers are main's, MOD included
    expect(p.hunks.flatMap((h) => h.lines).find((l) => l.text.includes('MOD'))).toMatchObject({ kind: 'ctx', old: 4, new: 4 });
  });

  it('unions insertions at the same spot, like promotion would', () => {
    const p = overlayPatch('r.ts', registry('MAX', 'PRODUCT'), registry('MAX', 'MOD', 'PRODUCT'), registry('MAX', 'MODE', 'PRODUCT'));
    expect(p).toMatchObject({ added: 1, removed: 0, against: 'rebased' });
    expect(lines(p, 'add')).toEqual(["MODE: () => import('../functions/math/MODE'),"]);
  });

  it('falls back to the overlay against its pin when it conflicts with main', () => {
    const p = overlayPatch('a.ts', 'a\nb\nc\n', 'a\nmain\nc\n', 'a\nagent\nc\n');
    expect(p).toMatchObject({ added: 1, removed: 1, against: 'pin' });
    expect(lines(p, 'del')).toEqual(['b']);
    expect(lines(p, 'add')).toEqual(['agent']);
  });

  it('rebases a new file another agent also created and keeps both', () => {
    const p = overlayPatch('n.ts', null, 'theirs\n', 'ours\n');
    expect(p).toMatchObject({ status: 'modified', added: 1, removed: 0, against: 'rebased' });
  });

  it('shows an agent deletion against main', () => {
    expect(overlayPatch('d.ts', 'x\n', 'x\ny\n', null)).toMatchObject({ status: 'deleted', removed: 2 });
  });
});
