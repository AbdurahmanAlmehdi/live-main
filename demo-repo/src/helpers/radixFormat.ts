import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Formats an integer in base 2, 8 or 16 the way DEC2BIN / DEC2OCT / DEC2HEX (and the
 * BIN2HEX-style conversions) do:
 *   - the value must fit in 10 digits of two's complement: -radix^10/2 <= n < radix^10/2,
 *     otherwise #NUM!;
 *   - negative numbers are written as 10-digit two's complement ("FFFFFFFFFF" for -1),
 *     and `places` is ignored for them;
 *   - `places`, when given, pads with leading zeros; it must be 1..10 and at least the
 *     number of digits needed, otherwise #NUM!.
 * Output digits are upper case.
 */
export function formatRadix(n: number, radix: number, places?: number): string | FormulaError {
  throw new NotImplementedError('formatRadix (src/helpers/radixFormat.ts)');
}
