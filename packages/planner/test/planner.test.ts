import type { Task } from '@livemain/protocol';
import { describe, expect, it } from 'vitest';
import { importGraph, scoreFiles, tagContracts, transitiveDependents } from '../src/index.js';

const files = [
  { path: 'src/core/value.ts', text: 'export type Value = number;\n' },
  { path: 'src/core/coerce.ts', text: "import type { Value } from './value';\nexport const toNumber = (v: Value) => v;\n" },
  { path: 'src/core/registry.ts', text: "export const registry = {\n  SUM: () => import('../functions/math/SUM'),\n};\n" },
  { path: 'src/eval/evaluate.ts', text: "import { registry } from '../core/registry';\nimport { toNumber } from '../core/coerce.js';\nexport const evaluate = () => registry;\n" },
  { path: 'src/functions/math/SUM.ts', text: "import { toNumber } from '../../core/coerce';\nexport default toNumber;\n" },
  { path: 'tests/SUM.test.ts', text: "import { evaluate } from '../src/eval/evaluate';\n" },
];

describe('planner', () => {
  it('builds the import graph incl. dynamic imports and .js specifiers', () => {
    const g = importGraph(files);
    expect([...g.get('src/core/registry.ts')!]).toEqual(['src/functions/math/SUM.ts']);
    expect([...g.get('src/eval/evaluate.ts')!].sort()).toEqual(['src/core/coerce.ts', 'src/core/registry.ts']);
  });

  it('counts transitive dependents', () => {
    const d = transitiveDependents(importGraph(files));
    // value ← coerce ← (evaluate, SUM) ← (tests, registry→evaluate…)
    expect(d.get('src/core/value.ts')).toBe(5);
    expect(d.get('tests/SUM.test.ts')).toBe(0);
  });

  it('treats additive-only history as append-only, not load-bearing', () => {
    const scores = scoreFiles(files, [], 0.25, {
      'src/core/registry.ts': ['additive', 'additive', 'additive'],
      'src/core/coerce.ts': ['body'],
    });
    const by = Object.fromEntries(scores.map((s) => [s.path, s]));
    expect(by['src/core/value.ts']!.loadBearing).toBe(true);
    expect(by['src/core/coerce.ts']!.loadBearing).toBe(true);
    expect(by['src/core/registry.ts']!.appendOnly).toBe(true);
    expect(by['src/core/registry.ts']!.loadBearing).toBe(false);
  });

  it('tags tasks that touch load-bearing files as contracts', () => {
    const scores = scoreFiles(files, [], 0.25, { 'src/core/registry.ts': ['additive'] });
    const task = (id: string, expectedFiles: string[]): Task => ({ id, kind: 'leaf', title: id, prompt: '', tests: [], dependsOn: [], expectedFiles });
    const tagged = tagContracts([task('a', ['src/functions/math/MAX.ts', 'src/core/registry.ts']), task('b', ['src/core/coerce.ts'])], scores);
    expect(tagged.map((t) => !!t.contract)).toEqual([false, true]);
  });

  it('uses text history through sigdiff', () => {
    const scores = scoreFiles(files, [
      { changes: [{ path: 'src/core/registry.ts', before: 'export const registry = {\n};\n', after: "export const registry = {\n  SUM: () => import('x'),\n};\n" }] },
    ]);
    expect(scores.find((s) => s.path === 'src/core/registry.ts')!.appendOnly).toBe(true);
  });
});
