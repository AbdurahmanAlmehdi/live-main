/**
 * Decimal rounding with spreadsheet semantics.
 *
 * Numbers are rounded on their decimal representation (at most 15 significant digits),
 * so ROUND(2.675, 2) is 2.68 even though 2.675 is stored as 2.67499999... in binary.
 * `digits` may be negative to round to tens, hundreds, ... and must be an integer.
 */

/** Moves the decimal point of `n` by `digits` places without binary noise. */
function shift(n: number, digits: number): number {
  const [mantissa, exponent = '0'] = String(n).split('e');
  return Number(`${mantissa}e${Number(exponent) + digits}`);
}

function roundWith(n: number, digits: number, mode: (x: number) => number): number {
  if (n === 0 || !Number.isFinite(n)) return n;
  const abs = Number(Math.abs(n).toPrecision(15));
  const result = shift(mode(shift(abs, digits)), -digits);
  return n < 0 ? -result : result;
}

/** ROUND: halves go away from zero (2.5 → 3, -2.5 → -3). */
export function roundHalfAwayFromZero(n: number, digits: number): number {
  return roundWith(n, digits, Math.round);
}

/** ROUNDUP: always away from zero (3.21 → 3.3 at 1 digit, -3.21 → -3.3). */
export function roundAwayFromZero(n: number, digits: number): number {
  return roundWith(n, digits, Math.ceil);
}

/** ROUNDDOWN / TRUNC: always toward zero (3.29 → 3.2 at 1 digit, -3.29 → -3.2). */
export function roundTowardZero(n: number, digits: number): number {
  return roundWith(n, digits, Math.floor);
}
