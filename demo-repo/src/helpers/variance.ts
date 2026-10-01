import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** Sample variance (n - 1 denominator); #DIV/0! for fewer than two values. */
export function variance(values: readonly number[]): number | FormulaError {
  throw new NotImplementedError('variance (src/helpers/variance.ts)');
}
