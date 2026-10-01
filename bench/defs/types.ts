/** Shapes of the hand-written definitions that build-bank turns into tasks.json + solutions. */

export type Category =
  | 'math'
  | 'statistical'
  | 'text'
  | 'logical'
  | 'date'
  | 'lookup'
  | 'information'
  | 'financial'
  | 'engineering';

export type ErrorCode = '#NULL!' | '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#N/A';

/** An expected result, as written into a generated test. */
export type Expected = number | string | boolean | { error: ErrorCode } | Expected[][];

/**
 * One test case. A bare string is a formula whose expectation comes from formula.js.
 * `expect` overrides formula.js (with `why`) where it disagrees with Excel or with our
 * value model; `digits` overrides the comparison precision for approximate algorithms.
 */
export type Case = string | { f: string; expect?: Expected; why?: string; digits?: number };

export interface FnSpec {
  /** Spreadsheet name, upper case, may contain dots (CEILING.MATH). */
  name: string;
  category: Category;
  /** Excel-style signature, e.g. "ROUND(number, num_digits)". */
  signature: string;
  /** One-sentence description used in the task prompt. */
  summary: string;
  cases: Case[];
  /** formula.js name when it differs from the spreadsheet name (dots are tried automatically). */
  oracleName?: string;
}

/** File-system-safe form of a function name: CEILING.MATH → CEILING_MATH. */
export function fileNameOf(name: string): string {
  return name.replace(/\./g, '_');
}
