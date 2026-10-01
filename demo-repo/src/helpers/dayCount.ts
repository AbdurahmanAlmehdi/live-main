import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Days between two dates on a 360-day year (twelve 30-day months), as DAYS360 counts them.
 *   US (NASD) method: a start date on the 31st or on the last day of February becomes
 *   the 30th; an end date on the 31st becomes the 30th when the (adjusted) start day is
 *   the 30th, otherwise it becomes the 1st of the next month.
 *   European method: start and end dates on the 31st become the 30th.
 */
export function days360(start: number, end: number, european: boolean): number | FormulaError {
  throw new NotImplementedError('days360 (src/helpers/dayCount.ts)');
}

/**
 * Fraction of a year between two serials (YEARFRAC), for day-count `basis`:
 *   0 US 30/360, 1 actual/actual, 2 actual/360, 3 actual/365, 4 European 30/360.
 * The order of the dates does not matter. #NUM! for another basis.
 */
export function yearFraction(start: number, end: number, basis: number): number | FormulaError {
  throw new NotImplementedError('yearFraction (src/helpers/dayCount.ts)');
}
