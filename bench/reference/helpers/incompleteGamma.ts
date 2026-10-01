import { gammaLn } from './gamma';

/**
 * Regularized incomplete gamma functions P(a, x) and Q(a, x) = 1 - P(a, x), for a > 0 and
 * x >= 0, by series expansion (x < a + 1) or Lentz's continued fraction (otherwise).
 */

const EPS = 1e-16;
const MAX_ITERATIONS = 1000;
const TINY = 1e-300;

function series(a: number, x: number): number {
  let term = 1 / a;
  let sum = term;
  for (let n = 1; n < MAX_ITERATIONS; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
}

function continuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
}

/** P(a, x): the lower regularized incomplete gamma function. */
export function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  return x < a + 1 ? series(a, x) : 1 - continuedFraction(a, x);
}

/** Q(a, x) = 1 - P(a, x), accurate even when P is close to 1. */
export function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - series(a, x) : continuedFraction(a, x);
}
