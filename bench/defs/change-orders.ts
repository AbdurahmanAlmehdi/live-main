/**
 * Change orders: contract changes to src/core, released part-way through a run. Each one
 * edits core, rewrites every existing call site with codemods (src/** and tests/core/**),
 * and adds tests in tests/core/<id>.test.ts that fail before it lands. Every change is
 * observable at runtime (vitest strips types): code written against the old contract
 * throws or misbehaves once the change order has landed.
 *
 * Solution variants of other tasks are derived by applying these codemods to their ops
 * (see build-bank), so the codemods double as the definition of "the new way to call it".
 */
import type { Op } from '../src/bank.ts';

export interface ChangeOrderDef {
  id: string;
  title: string;
  /** The ticket. */
  ask: string;
  releaseAt: number;
  /** Core edits (applied first), then codemods over call sites. */
  edits: Extract<Op, { op: 'edit' }>[];
  codemods: Extract<Op, { op: 'codemod' }>[];
  /**
   * After the codemods, no file may still match this (the old API is fully migrated).
   * Checked against every derived solution variant too.
   */
  residue: RegExp;
  test: { path: string; content: string };
  /** Core files the change order is about (for expectedFiles). */
  coreFiles: string[];
}

const SRC = 'src/**/*.ts';
const CORE_TESTS = 'tests/core/**/*.ts';

/** The same codemod over src/ and tests/core/. */
function everywhere(find: string, replace: string, flags = 'g'): Extract<Op, { op: 'codemod' }>[] {
  return [
    { op: 'codemod', glob: SRC, find, flags, replace },
    { op: 'codemod', glob: CORE_TESTS, find, flags, replace },
  ];
}

const edit = (path: string, oldString: string, newString: string): Extract<Op, { op: 'edit' }> => ({ op: 'edit', path, oldString, newString });

export const CHANGE_ORDERS: ChangeOrderDef[] = [
  {
    id: 'co-arity-tuple',
    title: 'FormulaFunction declares its arity as a tuple',
    ask:
      'Contract change: FormulaFunction no longer has minArgs/maxArgs. It declares `arity: [min, max]` ' +
      '(max is Infinity for variadic functions), and the evaluator reads `fn.arity` to check argument counts. ' +
      'Update src/core/types.ts and src/eval/evaluate.ts, migrate every existing function module and test, ' +
      'update the README example, and add tests/core/co-arity-tuple.test.ts covering the new contract.',
    releaseAt: 0.1,
    edits: [
      edit('src/core/types.ts', ` * A spreadsheet function. Arguments arrive already evaluated (errors included, as
 * values); the evaluator checks the argument count against minArgs/maxArgs before
 * calling. Functions return error values, they never throw them.
 */
export interface FormulaFunction {
  /** Minimum number of arguments. */
  minArgs: number;
  /** Maximum number of arguments (Infinity for variadic functions). */
  maxArgs: number;`, ` * A spreadsheet function. Arguments arrive already evaluated (errors included, as
 * values); the evaluator checks the argument count against \`arity\` before calling.
 * Functions return error values, they never throw them.
 */
export interface FormulaFunction {
  /** [minimum, maximum] number of arguments; the maximum is Infinity for variadic functions. */
  arity: readonly [min: number, max: number];`),
      edit('src/eval/evaluate.ts', `  if (args.length < fn.minArgs || args.length > fn.maxArgs) return err.na;`, `  const [minArgs, maxArgs] = fn.arity;
  if (args.length < minArgs || args.length > maxArgs) return err.na;`),
      edit('README.md', `     minArgs: 1,
     maxArgs: 1,`, `     arity: [1, 1],`),
      edit('README.md', `   The evaluator checks the argument count before calling \`call\``, `   The evaluator checks the argument count against \`arity\` before calling \`call\``),
    ],
    codemods: [
      { op: 'codemod', glob: 'src/functions/**/*.ts', find: String.raw`minArgs: (\d+),\n\s*maxArgs: (\w+),`, flags: 'g', replace: 'arity: [$1, $2],' },
      { op: 'codemod', glob: CORE_TESTS, find: String.raw`minArgs: (\d+), maxArgs: (\w+),`, flags: 'g', replace: 'arity: [$1, $2],' },
    ],
    residue: /\b(minArgs|maxArgs):/,
    coreFiles: ['src/core/types.ts', 'src/eval/evaluate.ts'],
    test: {
      path: 'tests/core/co-arity-tuple.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import type { FormulaFunction, FunctionLoader } from '../../src/core/types';

const loader = (fn: FormulaFunction): FunctionLoader => () => Promise.resolve({ default: fn });

const registry: Record<string, FunctionLoader> = {
  PAIR: loader({ arity: [1, 2], call: (args) => args.length }),
  ANY: loader({ arity: [0, Infinity], call: (args) => args.length }),
};

describe('FormulaFunction.arity', () => {
  it('accepts argument counts inside the arity', async () => {
    expect(await evaluate('=PAIR(1)', { registry })).toBe(1);
    expect(await evaluate('=PAIR(1, 2)', { registry })).toBe(2);
    expect(await evaluate('=ANY()', { registry })).toBe(0);
    expect(await evaluate('=ANY(1, 2, 3, 4, 5)', { registry })).toBe(5);
  });

  it('returns #N/A outside the arity', async () => {
    expect(await evaluate('=PAIR()', { registry })).toMatchObject({ code: '#N/A' });
    expect(await evaluate('=PAIR(1, 2, 3)', { registry })).toMatchObject({ code: '#N/A' });
  });
});
`,
    },
  },
  {
    id: 'co-number-to-text',
    title: 'Rename formatGeneral to numberToText',
    ask:
      'Contract change: `formatGeneral(n)` in src/core/coerce.ts is renamed to `numberToText(n)` (same behaviour: ' +
      'the General number format, at most 15 significant digits). Remove the old name, update every caller and ' +
      'test, and add tests/core/co-number-to-text.test.ts.',
    releaseAt: 0.15,
    edits: [
      edit('src/core/coerce.ts', `/**
 * Formats a number the way the "General" format turns it into text: at most 15
 * significant digits, no trailing zeros, exponent notation for very large or
 * very small magnitudes ("1E+21").
 */
export function formatGeneral(n: number): string {`, `/**
 * The text of a number in the "General" format (what toText uses): at most 15
 * significant digits, no trailing zeros, exponent notation for very large or
 * very small magnitudes ("1E+21").
 */
export function numberToText(n: number): string {`),
    ],
    codemods: [...everywhere(String.raw`\bformatGeneral\b`, 'numberToText'), { op: 'codemod', glob: 'README.md', find: String.raw`\bformatGeneral\b`, flags: 'g', replace: 'numberToText' }],
    residue: /\bformatGeneral\b/,
    coreFiles: ['src/core/coerce.ts'],
    test: {
      path: 'tests/core/co-number-to-text.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import * as coerce from '../../src/core/coerce';

describe('numberToText', () => {
  it('formats numbers in the General format', () => {
    expect(coerce.numberToText(0.1 + 0.2)).toBe('0.3');
    expect(coerce.numberToText(-12.5)).toBe('-12.5');
    expect(coerce.numberToText(1e21)).toBe('1E+21');
  });

  it('replaces formatGeneral', () => {
    expect('formatGeneral' in coerce).toBe(false);
  });
});
`,
    },
  },
  {
    id: 'co-flatten-opts',
    title: 'flattenArgs takes required options',
    ask:
      'Contract change: `flattenArgs(args)` becomes `flattenArgs(args, opts)` where `opts: FlattenOptions` is required and ' +
      'says what to do with empty values: `{ blanks: \'keep\' }` keeps them as null (the old behaviour) and ' +
      '`{ blanks: \'skip\' }` drops them. Migrate every caller (keeping today\'s behaviour) and add ' +
      'tests/core/co-flatten-opts.test.ts.',
    releaseAt: 0.25,
    edits: [
      edit('src/core/args.ts', `/** Flattens arguments into scalars, expanding ranges row by row. */
export function flattenArgs(args: readonly Value[]): Scalar[] {
  const out: Scalar[] = [];
  for (const arg of args) {
    if (arg instanceof RangeValue) {
      for (const row of arg.rows) out.push(...row);
    } else {
      out.push(arg);
    }
  }
  return out;
}`, `export interface FlattenOptions {
  /** Empty values (missing arguments, empty cells): 'keep' them as null, or 'skip' them. */
  blanks: 'keep' | 'skip';
}

/** Flattens arguments into scalars, expanding ranges row by row. */
export function flattenArgs(args: readonly Value[], opts: FlattenOptions): Scalar[] {
  const { blanks } = opts;
  const out: Scalar[] = [];
  for (const arg of args) {
    const cells = arg instanceof RangeValue ? arg.rows.flat() : [arg];
    for (const cell of cells) {
      if (cell === null && blanks === 'skip') continue;
      out.push(cell);
    }
  }
  return out;
}`),
      edit('tests/core/args.test.ts', `    expect(flattenArgs([1, new RangeValue([[2, 'a'], [true, null]]), 'b'])).toEqual([1, 2, 'a', true, null, 'b']);`, `    expect(flattenArgs([1, new RangeValue([[2, 'a'], [true, null]]), 'b'], { blanks: 'keep' })).toEqual([1, 2, 'a', true, null, 'b']);`),
    ],
    codemods: everywhere(String.raw`(?<!function )\bflattenArgs\(([\w.\[\]]+)\)`, "flattenArgs($1, { blanks: 'keep' })"),
    residue: /(?<!function )\bflattenArgs\((?![^\n]*blanks)/,
    coreFiles: ['src/core/args.ts'],
    test: {
      path: 'tests/core/co-flatten-opts.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { flattenArgs } from '../../src/core/args';
import { evaluate } from '../../src/eval/evaluate';
import type { Value } from '../../src/core/value';

const args = async (): Promise<Value[]> => [1, null, await evaluate('={2, "a"; TRUE, 3}'), 'b'];

describe('flattenArgs options', () => {
  it('keeps blanks when asked', async () => {
    expect(flattenArgs(await args(), { blanks: 'keep' })).toEqual([1, null, 2, 'a', true, 3, 'b']);
  });

  it('skips blanks when asked', async () => {
    expect(flattenArgs(await args(), { blanks: 'skip' })).toEqual([1, 2, 'a', true, 3, 'b']);
  });

  it('requires the options', async () => {
    const call = flattenArgs as unknown as (a: Value[]) => unknown;
    expect(() => call(['x'])).toThrow(TypeError);
  });
});
`,
    },
  },
  {
    id: 'co-first-error-array',
    title: 'firstError takes an array',
    ask:
      'Contract change: `firstError(...values)` becomes `firstError(values)`, taking one array ' +
      '(`firstError([a, b])`), so it can be used directly on argument lists. Migrate every caller and test and add ' +
      'tests/core/co-first-error-array.test.ts.',
    releaseAt: 0.32,
    edits: [
      edit('src/core/errors.ts', `/**
 * Returns the first argument that is an error, or undefined.
 * Typical use: \`const e = firstError(a, b); if (e) return e;\`
 */
export function firstError(...values: unknown[]): FormulaError | undefined {
  for (const value of values) {
    if (isError(value)) return value;
  }
  return undefined;
}`, `/**
 * Returns the first value in the list that is an error, or undefined.
 * Typical use: \`const e = firstError([a, b]); if (e) return e;\`
 */
export function firstError(values: readonly unknown[]): FormulaError | undefined {
  return values.find((value): value is FormulaError => isError(value));
}`),
    ],
    codemods: everywhere(String.raw`(?<!function )\bfirstError\((?!\[)([^()]*)\)`, 'firstError([$1])'),
    residue: /(?<!function )\bfirstError\((?!\[)/,
    coreFiles: ['src/core/errors.ts'],
    test: {
      path: 'tests/core/co-first-error-array.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { err, firstError } from '../../src/core/errors';

describe('firstError(values)', () => {
  it('finds the first error in a list', () => {
    expect(firstError([1, err.num, err.na])).toBe(err.num);
    expect(firstError(['a', true, null])).toBeUndefined();
    expect(firstError([])).toBeUndefined();
  });

  it('rejects the old variadic call', () => {
    const call = firstError as unknown as (...v: unknown[]) => unknown;
    expect(() => call(1, err.na)).toThrow(TypeError);
  });
});
`,
    },
  },
  {
    id: 'co-dimensions-object',
    title: 'dimensions returns { height, width }',
    ask:
      'Contract change: `dimensions(value)` in src/core/range.ts returns `{ height, width }` instead of a ' +
      '`[height, width]` tuple. Migrate every caller and test and add tests/core/co-dimensions-object.test.ts.',
    releaseAt: 0.4,
    edits: [
      edit('src/core/range.ts', `/** [height, width] of a value (a scalar is 1x1). */
export function dimensions(value: Value): [number, number] {
  return value instanceof RangeValue ? [value.height, value.width] : [1, 1];
}`, `/** Size of a value (a scalar is 1x1). */
export function dimensions(value: Value): { height: number; width: number } {
  return value instanceof RangeValue ? { height: value.height, width: value.width } : { height: 1, width: 1 };
}`),
      edit('tests/core/range.test.ts', `    expect(dimensions(5)).toEqual([1, 1]);`, `    expect(dimensions(5)).toEqual({ height: 1, width: 1 });`),
      edit('tests/core/range.test.ts', `    expect(dimensions(fromRows([[1, 2], [3, 4], [5, 6]]))).toEqual([3, 2]);`, `    expect(dimensions(fromRows([[1, 2], [3, 4], [5, 6]]))).toEqual({ height: 3, width: 2 });`),
    ],
    codemods: [
      ...everywhere(String.raw`const \[(\w+), (\w+)\] = dimensions\(`, 'const { height: $1, width: $2 } = dimensions('),
      ...everywhere(String.raw`const \[, (\w+)\] = dimensions\(`, 'const { width: $1 } = dimensions('),
      ...everywhere(String.raw`const \[(\w+)\] = dimensions\(`, 'const { height: $1 } = dimensions('),
    ],
    residue: /\[[\w, ]*\] = dimensions\(|\bdimensions\([^()]*\)\[/,
    coreFiles: ['src/core/range.ts'],
    test: {
      path: 'tests/core/co-dimensions-object.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { dimensions } from '../../src/core/range';
import { evaluate } from '../../src/eval/evaluate';

describe('dimensions', () => {
  it('returns height and width', async () => {
    expect(dimensions(await evaluate('={1, 2, 3; 4, 5, 6}'))).toEqual({ height: 2, width: 3 });
    expect(dimensions('x')).toEqual({ height: 1, width: 1 });
  });

  it('is not a tuple any more', () => {
    expect(Array.isArray(dimensions(1))).toBe(false);
  });
});
`,
    },
  },
  {
    id: 'co-range-immutable',
    title: 'RangeValue becomes immutable',
    ask:
      'Contract change: RangeValue no longer exposes its `rows` array and can no longer be built with `new`. ' +
      'Build ranges with `RangeValue.fromRows(rows)` and read them with `.at(r, c)`, `.height`, `.width` or ' +
      '`.toRows()` (which returns a copy). Store the cells privately. Migrate every caller and test and add ' +
      'tests/core/co-range-immutable.test.ts.',
    releaseAt: 0.45,
    edits: [
      edit('src/core/value.ts', `/** A rectangular 2D array of scalars, stored row by row. */
export class RangeValue {
  constructor(readonly rows: Scalar[][]) {
    const width = rows[0]?.length ?? 0;
    if (rows.length === 0 || width === 0) throw new RangeError('RangeValue must have at least one cell');
    if (rows.some((row) => row.length !== width)) throw new RangeError('RangeValue rows must all have the same width');
  }

  get height(): number {
    return this.rows.length;
  }

  get width(): number {
    return this.rows[0].length;
  }

  /** The cell at (row, col), zero-based. */
  at(row: number, col: number): Scalar {
    return this.rows[row][col];
  }
}`, `/** A rectangular 2D array of scalars. Immutable: build one with RangeValue.fromRows. */
export class RangeValue {
  private constructor(
    readonly height: number,
    readonly width: number,
    private readonly cells: readonly Scalar[],
  ) {}

  /** Builds a range from rows of equal, non-zero length (the rows are copied). */
  static fromRows(rows: readonly (readonly Scalar[])[]): RangeValue {
    const height = rows.length;
    const width = rows[0]?.length ?? 0;
    if (height === 0 || width === 0) throw new RangeError('RangeValue must have at least one cell');
    if (rows.some((row) => row.length !== width)) throw new RangeError('RangeValue rows must all have the same width');
    return new RangeValue(height, width, rows.flat());
  }

  /** The cell at (row, col), zero-based. */
  at(row: number, col: number): Scalar {
    return this.cells[row * this.width + col];
  }

  /** A copy of the cells, row by row. */
  toRows(): Scalar[][] {
    return Array.from({ length: this.height }, (_, r) => this.cells.slice(r * this.width, (r + 1) * this.width));
  }
}`),
    ],
    codemods: [
      ...everywhere(String.raw`\bnew RangeValue\((?!height, width)`, 'RangeValue.fromRows('),
      ...everywhere(String.raw`\.rows\b(?!\()`, '.toRows()'),
    ],
    residue: /\bnew RangeValue\((?!height, width)|\.rows\b(?!\()/,
    coreFiles: ['src/core/value.ts'],
    test: {
      path: 'tests/core/co-range-immutable.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { RangeValue } from '../../src/core/value';

describe('immutable RangeValue', () => {
  it('builds from rows and reads cells', () => {
    const r = RangeValue.fromRows([[1, 2, 3], [4, 5, 6]]);
    expect([r.height, r.width]).toEqual([2, 3]);
    expect(r.at(1, 0)).toBe(4);
    expect(r.toRows()).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it('does not share its storage', () => {
    const rows = [[1, 2]];
    const r = RangeValue.fromRows(rows);
    rows[0][0] = 99;
    r.toRows()[0][1] = 99;
    expect(r.toRows()).toEqual([[1, 2]]);
  });

  it('no longer exposes rows', () => {
    expect((RangeValue.fromRows([[1]]) as unknown as { rows?: unknown }).rows).toBeUndefined();
  });
});
`,
    },
  },
  {
    id: 'co-compare-opts',
    title: 'compareScalars takes required options',
    ask:
      'Contract change: `compareScalars(a, b)` becomes `compareScalars(a, b, opts)` with a required ' +
      '`opts: CompareOptions` (`{ caseSensitive: boolean }`), so functions such as EXACT-style lookups can compare ' +
      'text case-sensitively. `scalarsEqual(a, b)` keeps its signature (case-insensitive). Migrate every caller ' +
      '(keeping today\'s case-insensitive behaviour) and add tests/core/co-compare-opts.test.ts.',
    releaseAt: 0.52,
    edits: [
      edit('src/core/compare.ts', `/** -1, 0 or 1. Both arguments must be non-error scalars. */
export function compareScalars(a: Scalar, b: Scalar): -1 | 0 | 1 {
  if (a === null && b === null) return 0;`, `export interface CompareOptions {
  /** Compare text case-sensitively ("a" < "B" either way; "a" and "A" differ only when true). */
  caseSensitive: boolean;
}

/** -1, 0 or 1. Both arguments must be non-error scalars. */
export function compareScalars(a: Scalar, b: Scalar, opts: CompareOptions): -1 | 0 | 1 {
  const { caseSensitive } = opts;
  if (a === null && b === null) return 0;`),
      edit('src/core/compare.ts', `  const l = typeof left === 'string' ? left.toLowerCase() : left;
  const r = typeof right === 'string' ? (right as string).toLowerCase() : right;
  if (l === r) return 0;
  return l < r ? -1 : 1;`, `  const l = typeof left === 'string' ? left.toLowerCase() : left;
  const r = typeof right === 'string' ? (right as string).toLowerCase() : right;
  if (l === r) {
    if (!caseSensitive || left === right) return 0;
    return left < right ? 1 : -1;
  }
  return l < r ? -1 : 1;`),
    ],
    codemods: everywhere(String.raw`(?<!function )\bcompareScalars\(([^(),]+), ([^(),]+)\)`, 'compareScalars($1, $2, { caseSensitive: false })'),
    residue: /(?<!function )\bcompareScalars\((?![^\n]*caseSensitive)/,
    coreFiles: ['src/core/compare.ts'],
    test: {
      path: 'tests/core/co-compare-opts.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { compareScalars, scalarsEqual } from '../../src/core/compare';

describe('compareScalars options', () => {
  it('compares text case-insensitively when asked', () => {
    expect(compareScalars('abc', 'ABC', { caseSensitive: false })).toBe(0);
    expect(compareScalars('a', 'B', { caseSensitive: false })).toBe(-1);
  });

  it('compares text case-sensitively when asked', () => {
    expect(compareScalars('abc', 'ABC', { caseSensitive: true })).not.toBe(0);
    expect(compareScalars('abc', 'abc', { caseSensitive: true })).toBe(0);
    expect(compareScalars('a', 'B', { caseSensitive: true })).toBe(-1);
  });

  it('keeps scalarsEqual case-insensitive', () => {
    expect(scalarsEqual('x', 'X')).toBe(true);
  });

  it('requires the options', () => {
    const call = compareScalars as unknown as (a: unknown, b: unknown) => unknown;
    expect(() => call(1, 2)).toThrow(TypeError);
  });
});
`,
    },
  },
  {
    id: 'co-to-int-explicit',
    title: 'Explicit integer rounding: toIntTrunc / toIntFloor',
    ask:
      'Contract change: `toInteger` in src/core/coerce.ts is removed. Use `toIntTrunc` (truncate toward zero, the old ' +
      'behaviour) or the new `toIntFloor` (round down). Migrate every caller (keeping truncation) and test, ' +
      'and add tests/core/co-to-int-explicit.test.ts.',
    releaseAt: 0.58,
    edits: [
      edit('src/core/coerce.ts', `/** Like toNumber, then truncated toward zero (2.7 → 2, -2.7 → -2). */
export function toInteger(value: Value): number | FormulaError {
  const n = toNumber(value);
  return n instanceof FormulaError ? n : Math.trunc(n);
}`, `/** Like toNumber, then truncated toward zero (2.7 → 2, -2.7 → -2). */
export function toIntTrunc(value: Value): number | FormulaError {
  const n = toNumber(value);
  return n instanceof FormulaError ? n : Math.trunc(n);
}

/** Like toNumber, then rounded down (2.7 → 2, -2.7 → -3). */
export function toIntFloor(value: Value): number | FormulaError {
  const n = toNumber(value);
  return n instanceof FormulaError ? n : Math.floor(n);
}`),
    ],
    codemods: [...everywhere(String.raw`\btoInteger\b`, 'toIntTrunc'), { op: 'codemod', glob: 'README.md', find: String.raw`\btoInteger\b`, flags: 'g', replace: 'toIntTrunc, toIntFloor' }],
    residue: /\btoInteger\b/,
    coreFiles: ['src/core/coerce.ts'],
    test: {
      path: 'tests/core/co-to-int-explicit.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import * as coerce from '../../src/core/coerce';

describe('explicit integer coercion', () => {
  it('truncates toward zero', () => {
    expect(coerce.toIntTrunc(2.7)).toBe(2);
    expect(coerce.toIntTrunc(-2.7)).toBe(-2);
    expect(coerce.toIntTrunc('x')).toMatchObject({ code: '#VALUE!' });
  });

  it('rounds down', () => {
    expect(coerce.toIntFloor(2.7)).toBe(2);
    expect(coerce.toIntFloor(-2.7)).toBe(-3);
    expect(coerce.toIntFloor('-0.5')).toBe(-1);
  });

  it('removes toInteger', () => {
    expect('toInteger' in coerce).toBe(false);
  });
});
`,
    },
  },
  {
    id: 'co-to-boolean-opts',
    title: 'toBoolean takes required options',
    ask:
      'Contract change: `toBoolean(value)` becomes `toBoolean(value, opts)` with a required `opts: BooleanOptions` ' +
      '(`{ text: \'parse\' | \'reject\' }`): \'parse\' reads "TRUE"/"FALSE" text as today, \'reject\' gives #VALUE! for any ' +
      'text. Migrate every caller (keeping today\'s behaviour) and test, and add tests/core/co-to-boolean-opts.test.ts.',
    releaseAt: 0.64,
    edits: [
      edit('src/core/coerce.ts', `/** Boolean coercion: numbers are TRUE when non-zero, empty → FALSE, "true"/"false" text (any case), other text → #VALUE!. */
export function toBoolean(value: Value): boolean | FormulaError {
  const cell = toCell(value);
  if (typeof cell === 'boolean') return cell;
  if (typeof cell === 'number') return cell !== 0;
  if (cell === null) return false;
  if (typeof cell === 'string') {
    const upper`, `export interface BooleanOptions {
  /** Text: 'parse' reads "true"/"false" (any case; other text is #VALUE!), 'reject' gives #VALUE! for all text. */
  text: 'parse' | 'reject';
}

/** Boolean coercion: numbers are TRUE when non-zero, empty → FALSE, text per \`opts.text\`. */
export function toBoolean(value: Value, opts: BooleanOptions): boolean | FormulaError {
  const { text } = opts;
  const cell = toCell(value);
  if (typeof cell === 'boolean') return cell;
  if (typeof cell === 'number') return cell !== 0;
  if (cell === null) return false;
  if (typeof cell === 'string') {
    if (text === 'reject') return err.value;
    const upper`),
    ],
    codemods: everywhere(String.raw`(?<!function )\btoBoolean\(((?:(?!\{ text)[^()])*)\)`, "toBoolean($1, { text: 'parse' })"),
    residue: /(?<!function )\btoBoolean\((?![^\n]*\{ text)/,
    coreFiles: ['src/core/coerce.ts'],
    test: {
      path: 'tests/core/co-to-boolean-opts.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { toBoolean } from '../../src/core/coerce';

describe('toBoolean options', () => {
  it('parses TRUE/FALSE text when asked', () => {
    expect(toBoolean('true', { text: 'parse' })).toBe(true);
    expect(toBoolean('FALSE', { text: 'parse' })).toBe(false);
    expect(toBoolean('maybe', { text: 'parse' })).toMatchObject({ code: '#VALUE!' });
  });

  it('rejects text when asked', () => {
    expect(toBoolean('TRUE', { text: 'reject' })).toMatchObject({ code: '#VALUE!' });
    expect(toBoolean(1, { text: 'reject' })).toBe(true);
  });

  it('requires the options', () => {
    const call = toBoolean as unknown as (v: unknown) => unknown;
    expect(() => call(1)).toThrow(TypeError);
  });
});
`,
    },
  },
  {
    id: 'co-optional-arg-value',
    title: 'optional* helpers take the argument value',
    ask:
      'Contract change: `optionalNumber(args, i, fallback)` (and optionalInteger / optionalBoolean / optionalText) ' +
      'become `optionalNumber(args[i], fallback)`: they take the argument value itself (undefined when omitted). ' +
      'Migrate every caller and test, and add tests/core/co-optional-arg-value.test.ts.',
    releaseAt: 0.7,
    edits: [
      edit('src/core/args.ts', `function isMissing(args: readonly Value[], index: number): boolean {
  return index >= args.length || args[index] === null;
}

/** The number at args[index], or \`fallback\` when the argument is omitted or empty. */
export function optionalNumber(args: readonly Value[], index: number, fallback: number): number | FormulaError {
  return isMissing(args, index) ? fallback : toNumber(args[index]);
}

/** Like optionalNumber, truncated to an integer. */
export function optionalInteger(args: readonly Value[], index: number, fallback: number): number | FormulaError {
  return isMissing(args, index) ? fallback : toInteger(args[index]);
}

/** The boolean at args[index], or \`fallback\` when the argument is omitted or empty. */
export function optionalBoolean(args: readonly Value[], index: number, fallback: boolean): boolean | FormulaError {
  return isMissing(args, index) ? fallback : toBoolean(args[index]);
}

/** The text at args[index], or \`fallback\` when the argument is omitted or empty. */
export function optionalText(args: readonly Value[], index: number, fallback: string): string | FormulaError {
  return isMissing(args, index) ? fallback : toText(args[index]);
}`, `/**
 * Optional arguments. Pass the argument itself, e.g. \`optionalNumber(args[2], 0)\`: an
 * omitted (undefined) or empty (null) argument gives the fallback.
 */

/** The number in an optional argument, or \`fallback\` when it is omitted or empty. */
export function optionalNumber(value: Value | undefined, fallback: number): number | FormulaError {
  return value === undefined || value === null ? fallback : toNumber(value);
}

/** Like optionalNumber, truncated to an integer. */
export function optionalInteger(value: Value | undefined, fallback: number): number | FormulaError {
  return value === undefined || value === null ? fallback : toInteger(value);
}

/** The boolean in an optional argument, or \`fallback\` when it is omitted or empty. */
export function optionalBoolean(value: Value | undefined, fallback: boolean): boolean | FormulaError {
  return value === undefined || value === null ? fallback : toBoolean(value);
}

/** The text in an optional argument, or \`fallback\` when it is omitted or empty. */
export function optionalText(value: Value | undefined, fallback: string): string | FormulaError {
  return value === undefined || value === null ? fallback : toText(value);
}`),
    ],
    codemods: everywhere(String.raw`(?<!function )\b(optional(?:Number|Integer|Boolean|Text))\((\w+), (\d+), `, '$1($2[$3], '),
    residue: /(?<!function )\boptional(?:Number|Integer|Boolean|Text)\(\w+,/,
    coreFiles: ['src/core/args.ts'],
    test: {
      path: 'tests/core/co-optional-arg-value.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { optionalBoolean, optionalInteger, optionalNumber, optionalText } from '../../src/core/args';

describe('optional argument helpers take the value', () => {
  it('fall back for omitted and empty arguments', () => {
    expect(optionalNumber(undefined, 7)).toBe(7);
    expect(optionalNumber(null, 7)).toBe(7);
    expect(optionalText(undefined, 'd')).toBe('d');
    expect(optionalBoolean(null, true)).toBe(true);
  });

  it('coerce present arguments', () => {
    expect(optionalNumber('2.5', 7)).toBe(2.5);
    expect(optionalInteger(-2.5, 7)).toBe(-2);
    expect(optionalBoolean(0, true)).toBe(false);
    expect(optionalText(1.5, '')).toBe('1.5');
  });

  it('reject the old (args, index, fallback) call', () => {
    const call = optionalNumber as unknown as (a: unknown, i: unknown, f: unknown) => unknown;
    expect(() => call([1, 2], 1, 0)).toThrow(TypeError);
  });
});
`,
    },
  },
  {
    id: 'co-check-number-rename',
    title: 'Rename checkNumber to numberResult',
    ask:
      'Contract change: `checkNumber(n)` in src/core/coerce.ts is renamed to `numberResult(n)` (same behaviour: NaN and ' +
      '±Infinity become #NUM!, -0 becomes 0). Remove the old name, migrate every caller and test, and add ' +
      'tests/core/co-check-number-rename.test.ts.',
    releaseAt: 0.78,
    edits: [
      edit('src/core/coerce.ts', `/**
 * Turns a raw numeric result into a cell value: NaN and ±Infinity become #NUM!,
 * -0 becomes 0. Use it on results of Math.* / arithmetic that can overflow.
 */
export function checkNumber(n: number): number | FormulaError {`, `/**
 * A raw numeric result as a cell value: NaN and ±Infinity become #NUM!, -0 becomes 0.
 * Use it on results of Math.* / arithmetic that can overflow.
 */
export function numberResult(n: number): number | FormulaError {`),
    ],
    codemods: [...everywhere(String.raw`\bcheckNumber\b`, 'numberResult'), { op: 'codemod', glob: 'README.md', find: String.raw`\bcheckNumber\b`, flags: 'g', replace: 'numberResult' }],
    residue: /\bcheckNumber\b/,
    coreFiles: ['src/core/coerce.ts'],
    test: {
      path: 'tests/core/co-check-number-rename.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import * as coerce from '../../src/core/coerce';

describe('numberResult', () => {
  it('maps non-finite numbers to #NUM!', () => {
    expect(coerce.numberResult(Infinity)).toMatchObject({ code: '#NUM!' });
    expect(coerce.numberResult(NaN)).toMatchObject({ code: '#NUM!' });
    expect(Object.is(coerce.numberResult(-0), 0)).toBe(true);
    expect(coerce.numberResult(1.5)).toBe(1.5);
  });

  it('replaces checkNumber', () => {
    expect('checkNumber' in coerce).toBe(false);
  });
});
`,
    },
  },
  {
    id: 'co-cells-order',
    title: 'cellsOf takes a required traversal order',
    ask:
      'Contract change: `cellsOf(value)` in src/core/range.ts becomes `cellsOf(value, opts)` with a required ' +
      '`opts: CellOrder` (`{ order: \'rows\' | \'columns\' }`): \'rows\' is today\'s row-by-row order, \'columns\' walks ' +
      'column by column. Migrate every caller (keeping row order) and test, and add tests/core/co-cells-order.test.ts.',
    releaseAt: 0.85,
    edits: [
      edit('src/core/range.ts', `/** All cells in row-major order (a scalar gives a one-element list). */
export function cellsOf(value: Value): Scalar[] {
  return value instanceof RangeValue ? value.rows.flat() : [value];
}`, `export interface CellOrder {
  /** 'rows': left to right, top to bottom; 'columns': top to bottom, left to right. */
  order: 'rows' | 'columns';
}

/** All cells in the requested order (a scalar gives a one-element list). */
export function cellsOf(value: Value, opts: CellOrder): Scalar[] {
  const { order } = opts;
  if (!(value instanceof RangeValue)) return [value];
  return order === 'rows' ? value.rows.flat() : transpose(value).rows.flat();
}`),
    ],
    codemods: everywhere(String.raw`(?<!function )\bcellsOf\(((?:(?!\{ order)[^()])*)\)`, "cellsOf($1, { order: 'rows' })"),
    residue: /(?<!function )\bcellsOf\((?![^\n]*\{ order)/,
    coreFiles: ['src/core/range.ts'],
    test: {
      path: 'tests/core/co-cells-order.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { cellsOf } from '../../src/core/range';
import { evaluate } from '../../src/eval/evaluate';

describe('cellsOf order', () => {
  it('walks rows or columns', async () => {
    const m = await evaluate('={1, 2; 3, 4}');
    expect(cellsOf(m, { order: 'rows' })).toEqual([1, 2, 3, 4]);
    expect(cellsOf(m, { order: 'columns' })).toEqual([1, 3, 2, 4]);
    expect(cellsOf(5, { order: 'columns' })).toEqual([5]);
  });

  it('requires the order', () => {
    const call = cellsOf as unknown as (v: unknown) => unknown;
    expect(() => call(5)).toThrow(TypeError);
  });
});
`,
    },
  },
];
