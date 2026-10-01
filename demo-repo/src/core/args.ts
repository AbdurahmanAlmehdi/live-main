import { FormulaError, RangeValue, type Scalar, type Value } from './value';
import { toBoolean, toInteger, toNumber, toText } from './coerce';

/**
 * Argument helpers.
 *
 * Spreadsheet functions treat a value differently depending on whether it was typed
 * directly as an argument or came from inside an array/range argument. For example
 * SUM("3", TRUE) is 4 (direct text and booleans are coerced), but SUM({"3", TRUE}) is 0
 * (text and booleans inside arrays are ignored).
 */

/** Flattens arguments into scalars, expanding ranges row by row. */
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
}

export interface CollectOptions {
  /**
   * Text passed directly as an argument: 'coerce' (default) parses it ("3" → 3,
   * "abc" → #VALUE!); 'ignore' skips it.
   */
  directText?: 'coerce' | 'ignore';
  /** Booleans passed directly: 'coerce' (default, TRUE → 1) or 'ignore'. */
  directBooleans?: 'coerce' | 'ignore';
  /** Empty arguments (e.g. SUM(1,,2)): 'zero' (default) counts them as 0, 'ignore' skips them. */
  directEmpty?: 'zero' | 'ignore';
}

/**
 * Collects the numbers in the arguments, SUM-style:
 *   - numbers count, wherever they are;
 *   - inside arrays/ranges, text, booleans and empty cells are ignored;
 *   - direct arguments are handled per `opts` (see CollectOptions);
 *   - the first error found is returned instead of a list.
 */
export function collectNumbers(args: readonly Value[], opts: CollectOptions = {}): number[] | FormulaError {
  const { directText = 'coerce', directBooleans = 'coerce', directEmpty = 'zero' } = opts;
  const out: number[] = [];
  for (const arg of args) {
    if (arg instanceof RangeValue) {
      for (const row of arg.rows) {
        for (const cell of row) {
          if (cell instanceof FormulaError) return cell;
          if (typeof cell === 'number') out.push(cell);
        }
      }
      continue;
    }
    if (arg instanceof FormulaError) return arg;
    if (typeof arg === 'string' && directText === 'ignore') continue;
    if (typeof arg === 'boolean' && directBooleans === 'ignore') continue;
    if (arg === null && directEmpty === 'ignore') continue;
    const n = toNumber(arg);
    if (n instanceof FormulaError) return n;
    out.push(n);
  }
  return out;
}

function isMissing(args: readonly Value[], index: number): boolean {
  return index >= args.length || args[index] === null;
}

/** The number at args[index], or `fallback` when the argument is omitted or empty. */
export function optionalNumber(args: readonly Value[], index: number, fallback: number): number | FormulaError {
  return isMissing(args, index) ? fallback : toNumber(args[index]);
}

/** Like optionalNumber, truncated to an integer. */
export function optionalInteger(args: readonly Value[], index: number, fallback: number): number | FormulaError {
  return isMissing(args, index) ? fallback : toInteger(args[index]);
}

/** The boolean at args[index], or `fallback` when the argument is omitted or empty. */
export function optionalBoolean(args: readonly Value[], index: number, fallback: boolean): boolean | FormulaError {
  return isMissing(args, index) ? fallback : toBoolean(args[index]);
}

/** The text at args[index], or `fallback` when the argument is omitted or empty. */
export function optionalText(args: readonly Value[], index: number, fallback: string): string | FormulaError {
  return isMissing(args, index) ? fallback : toText(args[index]);
}
