import { NotImplementedError } from '../core/errors';

/** The error function and its complement, via the incomplete gamma function. */

/** erf(x) = P(1/2, x²) with the sign of x. */
export function erf(x: number): number {
  throw new NotImplementedError('erf (src/helpers/erf.ts)');
}

/** erfc(x) = 1 - erf(x), accurate in the tails. */
export function erfc(x: number): number {
  throw new NotImplementedError('erfc (src/helpers/erf.ts)');
}
