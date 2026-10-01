import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** Day of week of a serial, 0 = Sunday .. 6 = Saturday (serial 1, 1900-01-01, counts as a Sunday). */
export function dayOfWeek(serial: number): number {
  throw new NotImplementedError('dayOfWeek (src/helpers/weekday.ts)');
}

/**
 * WEEKDAY numbering: return_type 1 (Sunday = 1 .. Saturday = 7), 2 (Monday = 1 .. Sunday = 7),
 * 3 (Monday = 0 .. Sunday = 6), 11..17 (week starting Monday..Sunday = 1).
 * #NUM! for other return types or out-of-range serials.
 */
export function weekdayOf(serial: number, returnType: number): number | FormulaError {
  throw new NotImplementedError('weekdayOf (src/helpers/weekday.ts)');
}

/**
 * Week of the year in "system 1": the week containing January 1 is week 1, and weeks
 * start on `weekStart` (0 = Sunday .. 6 = Saturday).
 */
export function weekOfYear(serial: number, weekStart: number): number | FormulaError {
  throw new NotImplementedError('weekOfYear (src/helpers/weekday.ts)');
}
