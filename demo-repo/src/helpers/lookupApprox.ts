import type { Scalar } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Approximate-match search over sorted data (MATCH 1 / -1, VLOOKUP TRUE, LOOKUP):
 *   - 'ascending': index of the largest value <= needle;
 *   - 'descending': index of the smallest value >= needle.
 * Only cells of the needle's type are considered; the scan stops at the first cell
 * that is past the needle. Returns -1 when there is no such value.
 */
export function findApproximate(needle: Scalar, haystack: readonly Scalar[], order: 'ascending' | 'descending'): number {
  throw new NotImplementedError('findApproximate (src/helpers/lookupApprox.ts)');
}
