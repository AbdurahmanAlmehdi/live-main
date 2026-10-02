import { describe, expect, it } from 'vitest';
import { sigdiff } from '../src/index.js';

const registry = (lines: string[]) => `import type { FunctionLoader } from './types';
export const registry: Record<string, FunctionLoader> = {
${lines.map((l) => `  ${l}`).join('\n')}
  // functions (one per line, keep this marker as the last line inside the object)
};
`;

describe('sigdiff', () => {
  it('registry entry added is additive', () => {
    const r = sigdiff(registry([]), registry(["SUM: () => import('../functions/math/SUM'),"]), 'src/core/registry.ts');
    expect(r.class).toBe('additive');
    expect(r.severity).toBe('ignore');
    expect(r.symbols.added).toEqual(['registry.SUM']);
  });

  it('registry entry changed is a body change; removed is signature', () => {
    const base = registry(["SUM: () => import('../functions/math/SUM'),"]);
    expect(sigdiff(base, registry(["SUM: () => import('../functions/math/SUM2'),"]), 'r.ts').class).toBe('body');
    expect(sigdiff(base, registry([]), 'r.ts').class).toBe('signature');
  });

  it('exported function signature change interrupts', () => {
    const a = 'export function toNumber(v: Value): number { return Number(v); }\n';
    const b = 'export function toNumber(v: Value, opts: CoerceOpts): number { return Number(v); }\n';
    const r = sigdiff(a, b, 'src/core/coerce.ts');
    expect(r.class).toBe('signature');
    expect(r.severity).toBe('interrupt');
    expect(r.reason).toContain('toNumber');
  });

  it('body-only change needs review', () => {
    const a = 'export const toNumber = (v: Value): number => Number(v);\n';
    const b = 'export const toNumber = (v: Value): number => (v === "" ? 0 : Number(v));\n';
    expect(sigdiff(a, b, 'c.ts')).toMatchObject({ class: 'body', severity: 'review' });
  });

  it('formatting and comments only is none', () => {
    const a = 'export function f(a: number) {\n  return a + 1;\n}\n';
    const b = '// explain f\nexport function f( a : number ) { return a+1 }\n';
    expect(sigdiff(a, b, 'f.ts').class).toBe('none');
  });

  it('adding a union member to an exported type is a contract change', () => {
    const a = "export type ErrorCode = '#N/A' | '#VALUE!';\n";
    const b = "export type ErrorCode = '#N/A' | '#VALUE!' | '#CALC!';\n";
    expect(sigdiff(a, b, 'v.ts').class).toBe('signature');
  });

  it('new export is additive, new import alone is additive', () => {
    const a = "import { x } from './x';\nexport const a = 1;\n";
    const b = "import { x } from './x';\nimport { y } from './y';\nexport const a = 1;\nexport function g() { return y; }\n";
    expect(sigdiff(a, b, 'a.ts').class).toBe('additive');
  });

  it('non-exported signature change is only a body change', () => {
    const a = 'function helper(a: number) { return a; }\nexport const f = () => helper(1);\n';
    const b = 'function helper(a: number, b = 2) { return a + b; }\nexport const f = () => helper(1);\n';
    expect(sigdiff(a, b, 'h.ts').class).toBe('body');
  });

  it('class members: public method signature vs private change', () => {
    const a = 'export class R { get(i: number) { return i; } private p(x: number) { return x; } }\n';
    const pub = 'export class R { get(i: number, j: number) { return i; } private p(x: number) { return x; } }\n';
    const priv = 'export class R { get(i: number) { return i; } private p(x: string) { return x; } }\n';
    expect(sigdiff(a, pub, 'r.ts').class).toBe('signature');
    expect(sigdiff(a, priv, 'r.ts').class).toBe('body');
  });

  it('file added / deleted', () => {
    expect(sigdiff(null, 'export const a = 1;', 'n.ts').class).toBe('additive');
    expect(sigdiff('export const a = 1;', null, 'n.ts').class).toBe('signature');
  });

  it('plain files: whitespace none, appended lines additive, edits body', () => {
    expect(sigdiff('a\nb\n', 'a\n  b\n\n', 'x.md').class).toBe('none');
    expect(sigdiff('a\nb\n', 'a\nb\nc\n', 'x.md').class).toBe('additive');
    expect(sigdiff('a\nb\n', 'a\nB\n', 'x.md').class).toBe('body');
  });

  it('export default object is diffed per property', () => {
    const a = 'export default { name: "SUM", fn: (a) => a };\n';
    const b = 'export default { name: "SUM", fn: (a) => a, volatile: false };\n';
    expect(sigdiff(a, b, 'SUM.ts').class).toBe('additive');
  });
});
