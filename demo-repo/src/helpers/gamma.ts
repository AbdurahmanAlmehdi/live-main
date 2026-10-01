import { NotImplementedError } from '../core/errors';

/** The gamma function, via the Lanczos approximation (about 15 significant digits). */

/** ln Γ(x) for x > 0 (NaN otherwise). */
export function gammaLn(x: number): number {
  throw new NotImplementedError('gammaLn (src/helpers/gamma.ts)');
}

/** Γ(x); NaN at 0 and the negative integers (the poles). */
export function gamma(x: number): number {
  throw new NotImplementedError('gamma (src/helpers/gamma.ts)');
}
