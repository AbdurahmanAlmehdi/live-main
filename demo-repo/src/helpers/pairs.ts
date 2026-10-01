import type { FormulaError, Value } from '../core/value';
import { NotImplementedError } from '../core/errors';

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
  throw new NotImplementedError('collectPairs (src/helpers/pairs.ts)');
}
