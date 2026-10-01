import type { FormulaError } from '../core/value';
import { err } from '../core/errors';
import { mean, sumOfSquaredDeviations } from './moments';

function standardizedPowerSum(values: readonly number[], power: number, sd: number, m: number): number {
  let total = 0;
  for (const v of values) total += Math.pow((v - m) / sd, power);
  return total;
}

/**
 * Sample skewness, n / ((n-1)(n-2)) * Σ((x - mean) / s)^3 with s the sample standard
 * deviation. #DIV/0! for fewer than three values or zero spread.
 */
export function skewness(values: readonly number[]): number | FormulaError {
  const n = values.length;
  if (n < 3) return err.div0;
  const sd = Math.sqrt(sumOfSquaredDeviations(values) / (n - 1));
  if (sd === 0) return err.div0;
  const m = mean(values) as number;
  return (n / ((n - 1) * (n - 2))) * standardizedPowerSum(values, 3, sd, m);
}

/**
 * Sample excess kurtosis:
 * n(n+1) / ((n-1)(n-2)(n-3)) * Σ((x - mean) / s)^4 - 3(n-1)^2 / ((n-2)(n-3)).
 * #DIV/0! for fewer than four values or zero spread.
 */
export function kurtosis(values: readonly number[]): number | FormulaError {
  const n = values.length;
  if (n < 4) return err.div0;
  const sd = Math.sqrt(sumOfSquaredDeviations(values) / (n - 1));
  if (sd === 0) return err.div0;
  const m = mean(values) as number;
  const sum4 = standardizedPowerSum(values, 4, sd, m);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4 - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
}
