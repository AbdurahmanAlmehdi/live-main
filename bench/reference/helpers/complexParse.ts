import type { FormulaError, Value } from '../core/value';
import { err, isError } from '../core/errors';
import { toText } from '../core/coerce';

/** A complex number as the IM* functions see it, remembering its "i" / "j" suffix. */
export interface Complex {
  re: number;
  im: number;
  suffix: 'i' | 'j';
}

const REAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseReal(text: string): number | undefined {
  return REAL.test(text) ? Number(text) : undefined;
}

/** Coefficient of the imaginary part: "" or "+" is 1, "-" is -1. */
function parseImaginary(text: string): number | undefined {
  if (text === '' || text === '+') return 1;
  if (text === '-') return -1;
  return parseReal(text);
}

/** Index of the sign that starts the imaginary part, ignoring a leading sign and exponent signs. */
function splitIndex(body: string): number {
  for (let i = body.length - 1; i > 0; i--) {
    if ((body[i] === '+' || body[i] === '-') && !/[eE]/.test(body[i - 1])) return i;
  }
  return -1;
}

/**
 * Reads a complex number from a value: a number is a real number; text must look like
 * "3+4i", "3-4j", "-2.5i", "i", "-j", "1e3+2i" or "7" ("" is 0). Booleans give
 * #VALUE!, malformed text gives #NUM!, errors pass through.
 */
export function parseComplex(value: Value): Complex | FormulaError {
  if (typeof value === 'number') return { re: value, im: 0, suffix: 'i' };
  if (typeof value === 'boolean') return err.value;
  const text = toText(value);
  if (isError(text)) return text;
  const s = text.trim();
  if (s === '') return { re: 0, im: 0, suffix: 'i' };
  const last = s[s.length - 1];
  if (last !== 'i' && last !== 'j') {
    const re = parseReal(s);
    return re === undefined ? err.num : { re, im: 0, suffix: 'i' };
  }
  const body = s.slice(0, -1);
  const split = splitIndex(body);
  const re = split < 0 ? 0 : parseReal(body.slice(0, split));
  const im = parseImaginary(split < 0 ? body : body.slice(split));
  if (re === undefined || im === undefined) return err.num;
  return { re, im, suffix: last };
}
