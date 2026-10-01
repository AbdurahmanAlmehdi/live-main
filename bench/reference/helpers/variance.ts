import type { FormulaError } from '../core/value';
import { err } from '../core/errors';
import { sumOfSquaredDeviations } from './moments';

/** Sample variance (n - 1 denominator); #DIV/0! for fewer than two values. */
export function variance(values: readonly number[]): number | FormulaError {
  if (values.length < 2) return err.div0;
  return sumOfSquaredDeviations(values) / (values.length - 1);
}
