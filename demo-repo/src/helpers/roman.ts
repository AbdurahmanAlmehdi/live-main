import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** Classic roman numerals (MCMXCIX style). */

/** Roman numeral for an integer 0..3999 (0 gives ""). */
export function toRoman(n: number): string {
  throw new NotImplementedError('toRoman (src/helpers/roman.ts)');
}

/**
 * Value of a roman numeral, case-insensitive, with an optional leading "-".
 * Subtractive pairs are read left to right ("MCMXCIX" = 1999); "" is 0.
 * Any character other than IVXLCDM gives #VALUE!.
 */
export function fromRoman(text: string): number | FormulaError {
  throw new NotImplementedError('fromRoman (src/helpers/roman.ts)');
}
