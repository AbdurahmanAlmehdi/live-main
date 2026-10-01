import { FormulaError, RangeValue, type Scalar, type Value } from './value';
import { err } from './errors';

/**
 * Type coercion, following spreadsheet rules. Every coercion returns either the
 * converted value or a FormulaError (errors in the input pass through unchanged).
 *
 * A 1x1 RangeValue coerces like its only cell; larger ranges give #VALUE!.
 */

/** Unwraps a 1x1 range to its cell; returns #VALUE! for a larger range. */
function toCell(value: Value): Scalar {
  if (value instanceof RangeValue) {
    return value.height === 1 && value.width === 1 ? value.at(0, 0) : err.value;
  }
  return value;
}

function unsupported(value: unknown): never {
  throw new TypeError(`not a spreadsheet Value: ${String(value)}`);
}

/**
 * Number coercion: TRUE → 1, FALSE → 0, empty → 0, numeric text → its number
 * ("1,000.5", " 12 ", "50%", "1e3", "$5"), other text → #VALUE!.
 */
export function toNumber(value: Value): number | FormulaError {
  const cell = toCell(value);
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'boolean') return cell ? 1 : 0;
  if (cell === null) return 0;
  if (typeof cell === 'string') return parseNumber(cell) ?? err.value;
  if (cell instanceof FormulaError) return cell;
  return unsupported(cell);
}

/** Like toNumber, then truncated toward zero (2.7 → 2, -2.7 → -2). */
export function toInteger(value: Value): number | FormulaError {
  const n = toNumber(value);
  return n instanceof FormulaError ? n : Math.trunc(n);
}

/** Text coercion: numbers use the general format, TRUE → "TRUE", empty → "". */
export function toText(value: Value): string | FormulaError {
  const cell = toCell(value);
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return formatGeneral(cell);
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
  if (cell === null) return '';
  if (cell instanceof FormulaError) return cell;
  return unsupported(cell);
}

/** Boolean coercion: numbers are TRUE when non-zero, empty → FALSE, "true"/"false" text (any case), other text → #VALUE!. */
export function toBoolean(value: Value): boolean | FormulaError {
  const cell = toCell(value);
  if (typeof cell === 'boolean') return cell;
  if (typeof cell === 'number') return cell !== 0;
  if (cell === null) return false;
  if (typeof cell === 'string') {
    const upper = cell.trim().toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
    return err.value;
  }
  if (cell instanceof FormulaError) return cell;
  return unsupported(cell);
}

const NUMBER_PATTERN = /^([+-]?)\$?((?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d*)?)(?:[eE]([+-]?\d+))?(%?)$/;

/**
 * Parses numeric text the way a spreadsheet does when text is used as a number.
 * Accepts surrounding spaces, a sign, a leading "$", thousands separators (","),
 * a decimal point ("."), an exponent and a trailing "%". Returns null when the text
 * is not a number (including the empty string).
 */
export function parseNumber(text: string): number | null {
  const match = NUMBER_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, sign, digits, exponent, percent] = match;
  if (!/\d/.test(digits)) return null;
  let n = Number(digits.replace(/,/g, '') + (exponent ? `e${exponent}` : ''));
  if (!Number.isFinite(n)) return null;
  if (percent) n /= 100;
  return sign === '-' ? -n : n;
}

/**
 * Formats a number the way the "General" format turns it into text: at most 15
 * significant digits, no trailing zeros, exponent notation for very large or
 * very small magnitudes ("1E+21").
 */
export function formatGeneral(n: number): string {
  if (n === 0) return '0';
  const rounded = Number(n.toPrecision(15));
  return String(rounded).replace('e+', 'E+').replace('e-', 'E-');
}

/**
 * Turns a raw numeric result into a cell value: NaN and ±Infinity become #NUM!,
 * -0 becomes 0. Use it on results of Math.* / arithmetic that can overflow.
 */
export function checkNumber(n: number): number | FormulaError {
  if (!Number.isFinite(n)) return err.num;
  return n === 0 ? 0 : n;
}
