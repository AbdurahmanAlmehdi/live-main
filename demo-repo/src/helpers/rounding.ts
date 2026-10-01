import { NotImplementedError } from '../core/errors';

/**
 * Decimal rounding with spreadsheet semantics.
 *
 * Numbers are rounded on their decimal representation (at most 15 significant digits),
 * so ROUND(2.675, 2) is 2.68 even though 2.675 is stored as 2.67499999... in binary.
 * `digits` may be negative to round to tens, hundreds, ... and must be an integer.
 */

/** ROUND: halves go away from zero (2.5 → 3, -2.5 → -3). */
export function roundHalfAwayFromZero(n: number, digits: number): number {
  throw new NotImplementedError('roundHalfAwayFromZero (src/helpers/rounding.ts)');
}

/** ROUNDUP: always away from zero (3.21 → 3.3 at 1 digit, -3.21 → -3.3). */
export function roundAwayFromZero(n: number, digits: number): number {
  throw new NotImplementedError('roundAwayFromZero (src/helpers/rounding.ts)');
}

/** ROUNDDOWN / TRUNC: always toward zero (3.29 → 3.2 at 1 digit, -3.29 → -3.2). */
export function roundTowardZero(n: number, digits: number): number {
  throw new NotImplementedError('roundTowardZero (src/helpers/rounding.ts)');
}
