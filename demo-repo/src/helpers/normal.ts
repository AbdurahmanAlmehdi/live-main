import { NotImplementedError } from '../core/errors';

/** The standard normal distribution. */

/** Density φ(z). */
export function normalPdf(z: number): number {
  throw new NotImplementedError('normalPdf (src/helpers/normal.ts)');
}

/** Cumulative Φ(z). */
export function normalCdf(z: number): number {
  throw new NotImplementedError('normalCdf (src/helpers/normal.ts)');
}

/** Inverse Φ⁻¹(p) for 0 < p < 1 (NaN otherwise). */
export function normalInv(p: number): number {
  throw new NotImplementedError('normalInv (src/helpers/normal.ts)');
}
