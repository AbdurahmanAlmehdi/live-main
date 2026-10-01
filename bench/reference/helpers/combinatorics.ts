/**
 * Counting functions on non-negative integers. Results that overflow are Infinity,
 * which callers report as #NUM!.
 */

/** n! for an integer n >= 0. */
export function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/** n!! = n * (n - 2) * (n - 4) * ... down to 1 or 2; 0!! = 1. */
export function doubleFactorial(n: number): number {
  let result = 1;
  for (let i = n; i > 1; i -= 2) result *= i;
  return result;
}

/** Number of ways to choose k items from n (0 <= k <= n), exact for results below 2^53. */
export function combinations(n: number, k: number): number {
  const r = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= r; i++) result = (result * (n - r + i)) / i;
  return Math.round(result);
}

/** Number of ordered arrangements of k items from n (0 <= k <= n). */
export function permutations(n: number, k: number): number {
  let result = 1;
  for (let i = 0; i < k; i++) result *= n - i;
  return result;
}
