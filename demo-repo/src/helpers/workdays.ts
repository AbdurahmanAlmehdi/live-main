import type { FormulaError, Value } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** True for Monday..Friday serials that are not in `holidays` (whole-day serials). */
export function isWorkday(serial: number, holidays: ReadonlySet<number>): boolean {
  throw new NotImplementedError('isWorkday (src/helpers/workdays.ts)');
}

/**
 * The holiday list argument of NETWORKDAYS / WORKDAY as a set of whole-day serials.
 * Omitted (undefined or empty) gives an empty set; numbers are truncated; text and
 * booleans give #VALUE!; errors are returned.
 */
export function collectHolidays(value: Value | undefined): ReadonlySet<number> | FormulaError {
  throw new NotImplementedError('collectHolidays (src/helpers/workdays.ts)');
}
