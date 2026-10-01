import type { FormulaError } from '../core/value';
import { err, isError } from '../core/errors';
import { dateFromSerial, serialFromDate } from './dateSerial';

/** Day of week of a serial, 0 = Sunday .. 6 = Saturday (serial 1, 1900-01-01, counts as a Sunday). */
export function dayOfWeek(serial: number): number {
  return (((Math.floor(serial) - 1) % 7) + 7) % 7;
}

/** For each WEEKDAY return_type: the day (0 = Sunday) numbered 1, and whether numbering starts at 0. */
const RETURN_TYPES: Record<number, { first: number; zeroBased: boolean }> = {
  1: { first: 0, zeroBased: false },
  2: { first: 1, zeroBased: false },
  3: { first: 1, zeroBased: true },
  11: { first: 1, zeroBased: false },
  12: { first: 2, zeroBased: false },
  13: { first: 3, zeroBased: false },
  14: { first: 4, zeroBased: false },
  15: { first: 5, zeroBased: false },
  16: { first: 6, zeroBased: false },
  17: { first: 0, zeroBased: false },
};

/**
 * WEEKDAY numbering: return_type 1 (Sunday = 1 .. Saturday = 7), 2 (Monday = 1 .. Sunday = 7),
 * 3 (Monday = 0 .. Sunday = 6), 11..17 (week starting Monday..Sunday = 1).
 * #NUM! for other return types or out-of-range serials.
 */
export function weekdayOf(serial: number, returnType: number): number | FormulaError {
  const spec = RETURN_TYPES[returnType];
  if (!spec || serial < 0) return err.num;
  const offset = (dayOfWeek(serial) - spec.first + 7) % 7;
  return spec.zeroBased ? offset : offset + 1;
}

/**
 * Week of the year in "system 1": the week containing January 1 is week 1, and weeks
 * start on `weekStart` (0 = Sunday .. 6 = Saturday).
 */
export function weekOfYear(serial: number, weekStart: number): number | FormulaError {
  const parts = dateFromSerial(serial);
  if (isError(parts)) return parts;
  const jan1 = serialFromDate(parts.year, 1, 1) as number;
  const jan1Offset = (dayOfWeek(jan1) - weekStart + 7) % 7;
  return Math.floor((Math.floor(serial) - jan1 + jan1Offset) / 7) + 1;
}
