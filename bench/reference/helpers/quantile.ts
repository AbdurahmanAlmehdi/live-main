import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

/**
 * Inclusive percentile (PERCENTILE.INC): sorts the values and interpolates linearly at
 * rank k * (n - 1). k must be in [0, 1] and the list non-empty, otherwise #NUM!.
 */
export function percentileInclusive(values: readonly number[], k: number): number | FormulaError {
  if (values.length === 0 || k < 0 || k > 1) return err.num;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = k * (sorted.length - 1);
  const lower = Math.floor(rank);
  const fraction = rank - lower;
  if (fraction === 0) return sorted[lower];
  return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}
