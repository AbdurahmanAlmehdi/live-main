import { regularizedGammaP, regularizedGammaQ } from './incompleteGamma';

/** The error function and its complement, via the incomplete gamma function. */

/** erf(x) = P(1/2, x²) with the sign of x. */
export function erf(x: number): number {
  if (x === 0) return 0;
  const p = regularizedGammaP(0.5, x * x);
  return x < 0 ? -p : p;
}

/** erfc(x) = 1 - erf(x), accurate in the tails. */
export function erfc(x: number): number {
  if (x < 0) return 1 + regularizedGammaP(0.5, x * x);
  return regularizedGammaQ(0.5, x * x);
}
