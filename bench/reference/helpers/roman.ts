import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

/** Classic roman numerals (MCMXCIX style). */

const NUMERALS: readonly [string, number][] = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
  ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
  ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];

const LETTER_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** Roman numeral for an integer 0..3999 (0 gives ""). */
export function toRoman(n: number): string {
  let rest = n;
  let out = '';
  for (const [symbol, value] of NUMERALS) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

/**
 * Value of a roman numeral, case-insensitive, with an optional leading "-".
 * Subtractive pairs are read left to right ("MCMXCIX" = 1999); "" is 0.
 * Any character other than IVXLCDM gives #VALUE!.
 */
export function fromRoman(text: string): number | FormulaError {
  let s = text.trim().toUpperCase();
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const value = LETTER_VALUES[s[i]];
    if (value === undefined) return err.value;
    const next = i + 1 < s.length ? LETTER_VALUES[s[i + 1]] : undefined;
    if (next !== undefined && next > value) total -= value;
    else total += value;
  }
  return negative ? -total : total;
}
