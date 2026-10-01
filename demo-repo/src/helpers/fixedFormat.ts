import { NotImplementedError } from '../core/errors';

/**
 * Formats a number with a fixed number of decimals, as FIXED and DOLLAR do:
 * rounds half away from zero (negative `decimals` round to tens, hundreds, ...),
 * shows max(decimals, 0) decimals, and groups thousands with "," when `grouping` is true.
 * A negative result is prefixed with "-".
 */
export function formatFixed(n: number, decimals: number, grouping: boolean): string {
  throw new NotImplementedError('formatFixed (src/helpers/fixedFormat.ts)');
}
