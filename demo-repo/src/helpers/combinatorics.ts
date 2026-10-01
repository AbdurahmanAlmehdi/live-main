import { NotImplementedError } from '../core/errors';

/**
 * Counting functions on non-negative integers. Results that overflow are Infinity,
 * which callers report as #NUM!.
 */

/** n! for an integer n >= 0. */
export function factorial(n: number): number {
  throw new NotImplementedError('factorial (src/helpers/combinatorics.ts)');
}

/** n!! = n * (n - 2) * (n - 4) * ... down to 1 or 2; 0!! = 1. */
export function doubleFactorial(n: number): number {
  throw new NotImplementedError('doubleFactorial (src/helpers/combinatorics.ts)');
}

/** Number of ways to choose k items from n (0 <= k <= n), exact for results below 2^53. */
export function combinations(n: number, k: number): number {
  throw new NotImplementedError('combinations (src/helpers/combinatorics.ts)');
}

/** Number of ordered arrangements of k items from n (0 <= k <= n). */
export function permutations(n: number, k: number): number {
  throw new NotImplementedError('permutations (src/helpers/combinatorics.ts)');
}
