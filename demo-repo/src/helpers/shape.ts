import type { FormulaError } from '../core/value';
import type { mean } from './moments';
import { NotImplementedError } from '../core/errors';

/**
 * Sample skewness, n / ((n-1)(n-2)) * Σ((x - mean) / s)^3 with s the sample standard
 * deviation. #DIV/0! for fewer than three values or zero spread.
 */
export function skewness(values: readonly number[]): number | FormulaError {
  throw new NotImplementedError('skewness (src/helpers/shape.ts)');
}

/**
 * Sample excess kurtosis:
 * n(n+1) / ((n-1)(n-2)(n-3)) * Σ((x - mean) / s)^4 - 3(n-1)^2 / ((n-2)(n-3)).
 * #DIV/0! for fewer than four values or zero spread.
 */
export function kurtosis(values: readonly number[]): number | FormulaError {
  throw new NotImplementedError('kurtosis (src/helpers/shape.ts)');
}
