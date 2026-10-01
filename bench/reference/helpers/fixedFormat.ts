import { roundHalfAwayFromZero } from './rounding';

/**
 * Formats a number with a fixed number of decimals, as FIXED and DOLLAR do:
 * rounds half away from zero (negative `decimals` round to tens, hundreds, ...),
 * shows max(decimals, 0) decimals, and groups thousands with "," when `grouping` is true.
 * A negative result is prefixed with "-".
 */
export function formatFixed(n: number, decimals: number, grouping: boolean): string {
  const rounded = roundHalfAwayFromZero(n, decimals);
  const [whole, fraction] = Math.abs(rounded).toFixed(Math.max(decimals, 0)).split('.');
  const grouped = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  const body = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return rounded < 0 ? `-${body}` : body;
}
