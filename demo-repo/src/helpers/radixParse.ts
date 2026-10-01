import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Parses a number written in base 2..36, the way the engineering conversion
 * functions (BIN2DEC, HEX2DEC, OCT2DEC, ...) read their input:
 *   - digits are case-insensitive; an invalid digit gives #NUM!;
 *   - at most 10 digits, otherwise #NUM!;
 *   - for bases 2, 8 and 16 a 10-digit value whose top digit has its high bit set is
 *     negative in two's complement ("FFFFFFFFFF" in base 16 is -1);
 *   - "" is 0.
 */
export function parseRadix(text: string, radix: number): number | FormulaError {
  throw new NotImplementedError('parseRadix (src/helpers/radixParse.ts)');
}
