import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Inclusive percentile (PERCENTILE.INC): sorts the values and interpolates linearly at
 * rank k * (n - 1). k must be in [0, 1] and the list non-empty, otherwise #NUM!.
 */
export function percentileInclusive(values: readonly number[], k: number): number | FormulaError {
  throw new NotImplementedError('percentileInclusive (src/helpers/quantile.ts)');
}
