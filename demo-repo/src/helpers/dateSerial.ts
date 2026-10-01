import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Date serial numbers (the 1900 date system).
 *
 * Serial 1 is 1900-01-01. Like the spreadsheet it imitates, the system treats 1900 as a
 * leap year: serial 60 is the fictional 1900-02-29 and serial 61 is 1900-03-01. Serial 0
 * displays as 1900-01-00. The last supported date is 9999-12-31 (serial 2958465).
 */

export interface DateParts {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 (0 only for serial 0) */
  day: number;
}

export const MAX_SERIAL = 2958465;

/**
 * Serial number for a calendar date, normalising out-of-range months and days the way
 * DATE does: month 13 is January of the next year, day 0 is the last day of the previous
 * month, negative values count backwards. Years 0..1899 are taken as 1900..3799.
 * #NUM! when the year is outside 0..9999 or the result is before serial 0 or after 9999-12-31.
 */
export function serialFromDate(year: number, month: number, day: number): number | FormulaError {
  throw new NotImplementedError('serialFromDate (src/helpers/dateSerial.ts)');
}

/** Calendar date of a serial (the fraction, i.e. the time of day, is ignored). #NUM! when out of range. */
export function dateFromSerial(serial: number): DateParts | FormulaError {
  throw new NotImplementedError('dateFromSerial (src/helpers/dateSerial.ts)');
}

/** Number of days in a month of a year (proleptic Gregorian; February 1900 has 29). */
export function daysInMonth(year: number, month: number): number {
  throw new NotImplementedError('daysInMonth (src/helpers/dateSerial.ts)');
}
