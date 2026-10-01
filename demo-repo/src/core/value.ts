/**
 * The value model shared by the evaluator and every spreadsheet function.
 *
 * A formula evaluates to a `Value`:
 *   - `number`        numbers (dates and times are serial numbers, see README)
 *   - `string`        text
 *   - `boolean`       TRUE / FALSE
 *   - `null`          an empty value (a missing argument such as the 2nd in `ROUND(1.5,)`)
 *   - `FormulaError`  #DIV/0!, #VALUE!, ... (errors are values, never thrown)
 *   - `RangeValue`    a rectangular 2D array, e.g. the literal `{1,2;3,4}`
 */

export type ErrorCode = '#NULL!' | '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#N/A';

export const ERROR_CODES: readonly ErrorCode[] = ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A'];

/** A spreadsheet error value. Instances are immutable; compare them by `code`. */
export class FormulaError {
  constructor(readonly code: ErrorCode) {}

  toString(): string {
    return this.code;
  }
}

/** Anything that can live in a single cell. */
export type Scalar = number | string | boolean | null | FormulaError;

/** A rectangular 2D array of scalars, stored row by row. */
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
}

export type Value = Scalar | RangeValue;

export function isRange(value: Value): value is RangeValue {
  return value instanceof RangeValue;
}

/**
 * Converts any value to a plain matrix of scalars (a scalar becomes a 1x1 matrix).
 * Handy for asserting on array results in tests.
 */
export function toMatrix(value: Value): Scalar[][] {
  return isRange(value) ? value.rows.map((row) => [...row]) : [[value]];
}
