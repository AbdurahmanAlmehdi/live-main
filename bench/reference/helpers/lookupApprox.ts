import type { Scalar } from '../core/value';
import { compareScalars } from '../core/compare';

/**
 * Approximate-match search over sorted data (MATCH 1 / -1, VLOOKUP TRUE, LOOKUP):
 *   - 'ascending': index of the largest value <= needle;
 *   - 'descending': index of the smallest value >= needle.
 * Only cells of the needle's type are considered; the scan stops at the first cell
 * that is past the needle. Returns -1 when there is no such value.
 */
export function findApproximate(needle: Scalar, haystack: readonly Scalar[], order: 'ascending' | 'descending'): number {
  let found = -1;
  for (let i = 0; i < haystack.length; i++) {
    const cell = haystack[i];
    if (cell === null || typeof cell !== typeof needle) continue;
    const c = compareScalars(cell, needle);
    if (order === 'ascending' ? c > 0 : c < 0) break;
    found = i;
  }
  return found;
}
