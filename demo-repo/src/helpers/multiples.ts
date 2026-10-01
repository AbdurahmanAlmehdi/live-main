import { NotImplementedError } from '../core/errors';

/**
 * Rounding to a multiple of a positive step, robust to binary noise
 * (FLOOR(0.3, 0.1) must be 0.3, not 0.2).
 */

/** Largest multiple of `step` that is <= n (rounds toward -infinity). `step` must be > 0. */
export function floorToMultiple(n: number, step: number): number {
  throw new NotImplementedError('floorToMultiple (src/helpers/multiples.ts)');
}

/** Smallest multiple of `step` that is >= n (rounds toward +infinity). `step` must be > 0. */
export function ceilToMultiple(n: number, step: number): number {
  throw new NotImplementedError('ceilToMultiple (src/helpers/multiples.ts)');
}

/** Nearest multiple of `step`, halves away from zero (MROUND). `step` must be > 0. */
export function roundToMultiple(n: number, step: number): number {
  throw new NotImplementedError('roundToMultiple (src/helpers/multiples.ts)');
}
