import type { Complex } from './complexParse';
import { NotImplementedError } from '../core/errors';

/**
 * Text form of a complex number, as the IM* functions return it:
 * "3+4i", "3-4i", "4i", "i", "-i", "3", "0". A unit imaginary part is written without
 * the 1. Components use at most 15 significant digits.
 */
export function formatComplex(c: Complex): string {
  throw new NotImplementedError('formatComplex (src/helpers/complexFormat.ts)');
}
