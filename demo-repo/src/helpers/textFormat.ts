import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Number format codes, the subset TEXT supports:
 *   - "General";
 *   - number codes with 0 # ? placeholders, "." decimals, "," thousands separators (a
 *     trailing "," divides by 1000), "%" (multiplies by 100), scientific "E+00" / "E-00";
 *   - date/time codes yyyy yy mmmm mmm mm m dddd ddd dd d hh h mm ss (m/mm after h or
 *     before s means minutes) and AM/PM or A/P;
 *   - up to three sections "positive;negative;zero" (a negative number formatted with its
 *     own section loses its minus sign);
 *   - literal text in "double quotes" or after a backslash, and the characters $ - + / ( ) : space.
 */

/**
 * Formats a number with a format code (see the module comment). Returns #VALUE! for a
 * format code it cannot use (an empty code formats as "").
 */
export function formatWithPattern(value: number, pattern: string): string | FormulaError {
  throw new NotImplementedError('formatWithPattern (src/helpers/textFormat.ts)');
}
