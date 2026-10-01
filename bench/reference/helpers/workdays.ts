import type { FormulaError, Value } from '../core/value';
import { err, isError } from '../core/errors';
import { cellsOf } from '../core/range';
import { dayOfWeek } from './weekday';

/** True for Monday..Friday serials that are not in `holidays` (whole-day serials). */
export function isWorkday(serial: number, holidays: ReadonlySet<number>): boolean {
  const day = dayOfWeek(serial);
  return day !== 0 && day !== 6 && !holidays.has(Math.floor(serial));
}

/**
 * The holiday list argument of NETWORKDAYS / WORKDAY as a set of whole-day serials.
 * Omitted (undefined or empty) gives an empty set; numbers are truncated; text and
 * booleans give #VALUE!; errors are returned.
 */
export function collectHolidays(value: Value | undefined): ReadonlySet<number> | FormulaError {
  const holidays = new Set<number>();
  if (value === undefined || value === null) return holidays;
  for (const cell of cellsOf(value)) {
    if (isError(cell)) return cell;
    if (cell === null) continue;
    if (typeof cell !== 'number') return err.value;
    holidays.add(Math.floor(cell));
  }
  return holidays;
}
