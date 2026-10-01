import type { Scalar } from '../core/value';
import { isError } from '../core/errors';
import { compareScalars } from '../core/compare';
import { hasWildcards, wildcardToRegExp } from './wildcard';

/**
 * Exact-match search used by MATCH(…, 0), VLOOKUP(…, FALSE) and HLOOKUP(…, FALSE):
 * the index of the first cell equal to `needle`, or -1.
 *   - values only match cells of the same type (1 does not match "1");
 *   - text matches case-insensitively, and a needle with wildcards (* ? ~) is matched
 *     as a pattern against text cells.
 */
export function findExact(needle: Scalar, haystack: readonly Scalar[]): number {
  if (typeof needle === 'string' && hasWildcards(needle)) {
    const pattern = wildcardToRegExp(needle);
    return haystack.findIndex((cell) => typeof cell === 'string' && pattern.test(cell));
  }
  return haystack.findIndex(
    (cell) => cell !== null && !isError(cell) && typeof cell === typeof needle && compareScalars(cell, needle) === 0,
  );
}
