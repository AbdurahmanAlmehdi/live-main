/**
 * Oracle test generator: function specs (bench/defs/functions) → demo-repo/tests/functions/<NAME>.test.ts
 *
 * Expectations are computed with formula.js and written as literals (no formula.js at
 * test time). Cases with a hand-written `expect` override formula.js; every override and
 * every disagreement is recorded in bench/oracle/report.json for review.
 *
 * Usage: pnpm --filter @livemain/bench oracle [--only NAME,NAME] [--check] [--print]
 *   --print  print every case with the formula.js result and any override
 *   --check  do not write, exit 1 if any generated file would change
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { allSpecs } from '../defs/functions/index.ts';
import { fileNameOf, type Case, type Expected, type FnSpec } from '../defs/types.ts';
import { DEMO_REPO, BENCH } from '../src/paths.ts';
import { OracleError, oracleEvaluate } from './formulajs.ts';

process.env.TZ = 'UTC';

interface CaseReport {
  formula: string;
  /** formula.js result, or { failure } when formula.js could not evaluate the case. */
  oracle: Expected | { failure: string };
  expected: Expected;
  override?: string;
}

const MIN_CASES = 4;
const MAX_CASES = 12;

export function testPathOf(name: string): string {
  return `tests/functions/${fileNameOf(name)}.test.ts`;
}

function normalizeCase(c: Case): { f: string; expect?: Expected; why?: string; digits?: number } {
  return typeof c === 'string' ? { f: c } : c;
}

function runOracle(spec: FnSpec, formula: string): Expected | { failure: string } {
  try {
    return oracleEvaluate(formula, spec.oracleName ? { [spec.name]: spec.oracleName } : {});
  } catch (e) {
    return { failure: e instanceof Error ? e.message : String(e) };
  }
}

function isFailure(x: Expected | { failure: string }): x is { failure: string } {
  return typeof x === 'object' && x !== null && !Array.isArray(x) && 'failure' in x;
}

function sameExpected(a: Expected | { failure: string }, b: Expected): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  return JSON.stringify(a) === JSON.stringify(b);
}

export function buildCases(spec: FnSpec): CaseReport[] {
  return spec.cases.map((raw) => {
    const c = normalizeCase(raw);
    const oracle = runOracle(spec, c.f);
    if (c.expect !== undefined) {
      return { formula: c.f, oracle, expected: c.expect, override: c.why ?? 'hand-written expectation' };
    }
    if (isFailure(oracle)) {
      throw new OracleError(`${spec.name}: ${c.f}: ${oracle.failure} (add a hand-written expect)`);
    }
    return { formula: c.f, oracle, expected: oracle };
  });
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

/** Precision for toBeCloseTo: about 1e-9 relative, never coarser than the case asks for. */
function digitsFor(x: number, override?: number): number {
  if (override !== undefined) return override;
  const magnitude = Math.max(1, Math.abs(x));
  return 9 - Math.ceil(Math.log10(magnitude));
}

function scalarAssertion(actual: string, expected: Expected, digits?: number): string[] {
  if (typeof expected === 'number') return [`expect(${actual}).toBeCloseTo(${String(expected)}, ${digitsFor(expected, digits)});`];
  if (typeof expected === 'string') return [`expect(${actual}).toBe(${quote(expected)});`];
  if (typeof expected === 'boolean') return [`expect(${actual}).toBe(${expected});`];
  if (Array.isArray(expected)) throw new Error('nested arrays are not supported');
  return [`expect(${actual}).toMatchObject({ code: ${quote(expected.error)} });`];
}

function literal(e: Expected): string {
  if (typeof e === 'string') return quote(e);
  if (Array.isArray(e)) return `[${e.map((row) => `[${row.map(literal).join(', ')}]`).join(', ')}]`;
  return String(e);
}

function isExact(cells: Expected[]): boolean {
  return cells.every((c) => typeof c !== 'number' || Number.isInteger(c));
}

function caseBody(formula: string, expected: Expected, digits?: number): string[] {
  const call = `await evaluate(${quote(formula)})`;
  if (!Array.isArray(expected)) return scalarAssertion(call, expected, digits);
  const rows = expected as Expected[][];
  const cells = rows.flat();
  if (isExact(cells) && cells.every((c) => typeof c !== 'object')) {
    return [`expect(toMatrix(${call})).toEqual(${literal(rows)});`];
  }
  const lines = [`const m = toMatrix(${call});`, `expect(m.map((row) => row.length)).toEqual(${JSON.stringify(rows.map((r) => r.length))});`];
  rows.forEach((row, r) => row.forEach((cell, c) => lines.push(...scalarAssertion(`m[${r}][${c}]`, cell, digits))));
  return lines;
}

export function renderTestFile(spec: FnSpec, cases: CaseReport[]): string {
  const raw = spec.cases.map(normalizeCase);
  const usesMatrix = cases.some((c) => Array.isArray(c.expected));
  const lines: string[] = [
    `// Expected values come from a reference spreadsheet implementation, reviewed against Excel.`,
    `import { describe, expect, it } from 'vitest';`,
    `import { evaluate } from '../../src/eval/evaluate';`,
  ];
  if (usesMatrix) lines.push(`import { toMatrix } from '../../src/core/value';`);
  lines.push('', `describe(${quote(spec.name)}, () => {`);
  cases.forEach((c, i) => {
    lines.push(`  it(${quote(c.formula)}, async () => {`);
    for (const l of caseBody(c.formula, c.expected, raw[i].digits)) lines.push(`    ${l}`);
    lines.push('  });');
  });
  lines.push('});', '');
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : undefined;
  const check = args.includes('--check');
  const print = args.includes('--print');
  const specs = allSpecs.filter((s) => !only || only.has(s.name));
  const report: Record<string, CaseReport[]> = {};
  const problems: string[] = [];
  let changed = 0;
  const seen = new Set<string>();
  for (const spec of specs) {
    if (seen.has(spec.name)) problems.push(`duplicate spec ${spec.name}`);
    seen.add(spec.name);
    if (spec.cases.length < MIN_CASES || spec.cases.length > MAX_CASES) {
      problems.push(`${spec.name}: ${spec.cases.length} cases (want ${MIN_CASES}-${MAX_CASES})`);
    }
    let cases: CaseReport[];
    try {
      cases = buildCases(spec);
    } catch (e) {
      problems.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    report[spec.name] = cases;
    if (print) {
      for (const c of cases) {
        const shown = JSON.stringify(c.oracle);
        console.log(`${spec.name}  ${c.formula}  =>  ${shown}${c.override ? `   OVERRIDE ${JSON.stringify(c.expected)} (${c.override})` : ''}`);
      }
    }
    const path = join(DEMO_REPO, testPathOf(spec.name));
    const content = renderTestFile(spec, cases);
    const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    if (before !== content) {
      changed++;
      if (!check) {
        mkdirSync(join(DEMO_REPO, 'tests/functions'), { recursive: true });
        writeFileSync(path, content);
      }
    }
  }
  if (!only) {
    const overrides = Object.values(report).flat().filter((c) => c.override).length;
    const disagreements = Object.entries(report).flatMap(([name, cs]) =>
      cs.filter((c) => c.override && !sameExpected(c.oracle, c.expected)).map((c) => ({ name, ...c })),
    );
    writeFileSync(
      join(BENCH, 'oracle/report.json'),
      JSON.stringify({ functions: Object.keys(report).length, cases: Object.values(report).flat().length, overrides, disagreements, report }, null, 1) + '\n',
    );
  }
  for (const p of problems) console.error(`problem: ${p}`);
  console.log(`${specs.length} specs, ${changed} test files ${check ? 'would change' : 'written'}`);
  if (problems.length > 0 || (check && changed > 0)) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
