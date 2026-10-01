import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

/** Arithmetic mean; #DIV/0! for an empty list. */
export function mean(values: readonly number[]): number | FormulaError {
  if (values.length === 0) return err.div0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

/** Sum of squared deviations from the mean (0 for an empty list). */
export function sumOfSquaredDeviations(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  const m = total / values.length;
  let sq = 0;
  for (const v of values) sq += (v - m) * (v - m);
  return sq;
}
