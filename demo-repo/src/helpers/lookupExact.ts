import type { Scalar } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Exact-match search used by MATCH(…, 0), VLOOKUP(…, FALSE) and HLOOKUP(…, FALSE):
 * the index of the first cell equal to `needle`, or -1.
 *   - values only match cells of the same type (1 does not match "1");
 *   - text matches case-insensitively, and a needle with wildcards (* ? ~) is matched
 *     as a pattern against text cells.
 */
export function findExact(needle: Scalar, haystack: readonly Scalar[]): number {
  throw new NotImplementedError('findExact (src/helpers/lookupExact.ts)');
}
