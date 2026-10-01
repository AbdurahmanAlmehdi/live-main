import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** Arithmetic mean; #DIV/0! for an empty list. */
export function mean(values: readonly number[]): number | FormulaError {
  throw new NotImplementedError('mean (src/helpers/moments.ts)');
}

/** Sum of squared deviations from the mean (0 for an empty list). */
export function sumOfSquaredDeviations(values: readonly number[]): number {
  throw new NotImplementedError('sumOfSquaredDeviations (src/helpers/moments.ts)');
}
