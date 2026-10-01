import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

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

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 31);
export const MAX_SERIAL = 2958465;

/**
 * Serial number for a calendar date, normalising out-of-range months and days the way
 * DATE does: month 13 is January of the next year, day 0 is the last day of the previous
 * month, negative values count backwards. Years 0..1899 are taken as 1900..3799.
 * #NUM! when the year is outside 0..9999 or the result is before serial 0 or after 9999-12-31.
 */
export function serialFromDate(year: number, month: number, day: number): number | FormulaError {
  const y = year < 1900 ? year + 1900 : year;
  if (year < 0 || y > 9999) return err.num;
  const ms = Date.UTC(y, month - 1, 1) + (day - 1) * DAY_MS;
  let serial = Math.round((ms - EPOCH) / DAY_MS);
  // Dates from 1900-03-01 on are one higher because of the fictional 1900-02-29.
  if (serial >= 60) serial += 1;
  if (serial < 0 || serial > MAX_SERIAL) return err.num;
  return serial;
}

/** Calendar date of a serial (the fraction, i.e. the time of day, is ignored). #NUM! when out of range. */
export function dateFromSerial(serial: number): DateParts | FormulaError {
  const whole = Math.floor(serial);
  if (whole < 0 || whole > MAX_SERIAL) return err.num;
  if (whole === 0) return { year: 1900, month: 1, day: 0 };
  if (whole === 60) return { year: 1900, month: 2, day: 29 };
  const date = new Date(EPOCH + (whole < 60 ? whole : whole - 1) * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Number of days in a month of a year (proleptic Gregorian; February 1900 has 29). */
export function daysInMonth(year: number, month: number): number {
  if (year === 1900 && month === 2) return 29;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
