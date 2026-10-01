import type { FormulaError, Value } from '../core/value';
import { err, isError } from '../core/errors';
import { cellsOf } from '../core/range';

export interface Pairs {
  xs: number[];
  ys: number[];
}

/**
 * Pairs up two equally sized arrays for two-variable statistics (CORREL, SLOPE, ...):
 * the cells are matched in row-major order, an error in either array is returned, and a
 * pair is kept only when both cells are numbers. #N/A when the arrays differ in size.
 */
export function collectPairs(left: Value, right: Value): Pairs | FormulaError {
  const a = cellsOf(left);
  const b = cellsOf(right);
  if (a.length !== b.length) return err.na;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (isError(x)) return x;
    if (isError(y)) return y;
    if (typeof x === 'number' && typeof y === 'number') {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys };
}
