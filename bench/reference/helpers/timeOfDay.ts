import type { FormulaError } from '../core/value';
import { err } from '../core/errors';

/** Times of day are fractions of a day: 0.5 is 12:00:00. */

export interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

/**
 * Hour, minute and second of a serial's fractional part, rounded to the nearest second
 * (so 0.99999999 is 00:00:00 of the next day, i.e. 0:0:0). #NUM! for negative serials.
 */
export function timeFromSerial(serial: number): TimeParts | FormulaError {
  if (serial < 0) return err.num;
  const seconds = Math.round((serial - Math.floor(serial)) * 86400) % 86400;
  return { hour: Math.floor(seconds / 3600), minute: Math.floor((seconds % 3600) / 60), second: seconds % 60 };
}

/**
 * Fraction of a day for a time, as TIME computes it: components may overflow
 * (TIME(0, 90, 0) is 1:30) and whole days are dropped (TIME(25, 0, 0) is 1:00).
 * #NUM! when the total is negative or a component is 32768 or more.
 */
export function serialFromTime(hour: number, minute: number, second: number): number | FormulaError {
  if (hour >= 32768 || minute >= 32768 || second >= 32768) return err.num;
  const total = hour * 3600 + minute * 60 + second;
  if (total < 0) return err.num;
  return (total % 86400) / 86400;
}
