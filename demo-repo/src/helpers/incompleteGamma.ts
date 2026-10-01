import { NotImplementedError } from '../core/errors';

/**
 * Regularized incomplete gamma functions P(a, x) and Q(a, x) = 1 - P(a, x), for a > 0 and
 * x >= 0, by series expansion (x < a + 1) or Lentz's continued fraction (otherwise).
 */

/** P(a, x): the lower regularized incomplete gamma function. */
export function regularizedGammaP(a: number, x: number): number {
  throw new NotImplementedError('regularizedGammaP (src/helpers/incompleteGamma.ts)');
}

/** Q(a, x) = 1 - P(a, x), accurate even when P is close to 1. */
export function regularizedGammaQ(a: number, x: number): number {
  throw new NotImplementedError('regularizedGammaQ (src/helpers/incompleteGamma.ts)');
}
