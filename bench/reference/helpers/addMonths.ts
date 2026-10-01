import type { FormulaError } from '../core/value';
import { err, isError } from '../core/errors';
import { dateFromSerial, daysInMonth, serialFromDate } from './dateSerial';

function shiftMonth(year: number, month: number, months: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

/**
 * The same day `months` months later (EDATE); a day that does not exist in the target
 * month becomes its last day (Jan 31 + 1 month = Feb 28/29). `months` must be an integer.
 * #NUM! when the input or the result is out of range.
 */
export function addMonths(serial: number, months: number): number | FormulaError {
  const start = dateFromSerial(serial);
  if (isError(start)) return start;
  const { year, month } = shiftMonth(start.year, start.month, months);
  if (year < 1900 || year > 9999) return err.num;
  return serialFromDate(year, month, Math.min(start.day, daysInMonth(year, month)));
}

/** Serial of the last day of the month `months` months after the serial's month (EOMONTH). */
export function endOfMonth(serial: number, months: number): number | FormulaError {
  const start = dateFromSerial(serial);
  if (isError(start)) return start;
  const { year, month } = shiftMonth(start.year, start.month, months);
  if (year < 1900 || year > 9999) return err.num;
  return serialFromDate(year, month, daysInMonth(year, month));
}
