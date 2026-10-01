/**
 * Rounding to a multiple of a positive step, robust to binary noise
 * (FLOOR(0.3, 0.1) must be 0.3, not 0.2).
 */

/** n / step, snapped to the nearest integer when it is within rounding noise of one. */
function quotient(n: number, step: number): number {
  const q = n / step;
  const nearest = Math.round(q);
  return Math.abs(q - nearest) <= 1e-12 * Math.max(1, Math.abs(q)) ? nearest : q;
}

function clean(x: number): number {
  return x === 0 ? 0 : Number(x.toPrecision(15));
}

/** Largest multiple of `step` that is <= n (rounds toward -infinity). `step` must be > 0. */
export function floorToMultiple(n: number, step: number): number {
  return clean(Math.floor(quotient(n, step)) * step);
}

/** Smallest multiple of `step` that is >= n (rounds toward +infinity). `step` must be > 0. */
export function ceilToMultiple(n: number, step: number): number {
  return clean(Math.ceil(quotient(n, step)) * step);
}

/** Nearest multiple of `step`, halves away from zero (MROUND). `step` must be > 0. */
export function roundToMultiple(n: number, step: number): number {
  const q = quotient(Math.abs(n), step);
  const result = clean(Math.floor(q + 0.5) * step);
  return n < 0 ? -result : result;
}
