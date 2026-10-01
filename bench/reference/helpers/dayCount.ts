import type { FormulaError } from '../core/value';
import { err, isError } from '../core/errors';
import { dateFromSerial, daysInMonth, serialFromDate, type DateParts } from './dateSerial';

function isLastDayOfFebruary(d: DateParts): boolean {
  return d.month === 2 && d.day === daysInMonth(d.year, 2);
}

/**
 * Days between two dates on a 360-day year (twelve 30-day months), as DAYS360 counts them.
 *   US (NASD) method: a start date on the 31st or on the last day of February becomes
 *   the 30th; an end date on the 31st becomes the 30th when the (adjusted) start day is
 *   the 30th, otherwise it becomes the 1st of the next month.
 *   European method: start and end dates on the 31st become the 30th.
 */
export function days360(start: number, end: number, european: boolean): number | FormulaError {
  const a = dateFromSerial(start);
  if (isError(a)) return a;
  const b = dateFromSerial(end);
  if (isError(b)) return b;
  let startDay = a.day;
  let endDay = b.day;
  let endMonth = b.month;
  let endYear = b.year;
  if (european) {
    startDay = Math.min(startDay, 30);
    endDay = Math.min(endDay, 30);
  } else {
    if (startDay === 31 || isLastDayOfFebruary(a)) startDay = 30;
    if (endDay === 31) {
      if (startDay < 30) {
        endDay = 1;
        endMonth += 1;
        if (endMonth === 13) {
          endMonth = 1;
          endYear += 1;
        }
      } else {
        endDay = 30;
      }
    }
  }
  return (endYear - a.year) * 360 + (endMonth - a.month) * 30 + (endDay - startDay);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Actual/actual (basis 1) the way the spreadsheet computes it. */
function actualActual(start: number, end: number, a: DateParts, b: DateParts): number {
  const days = end - start;
  const withinAYear =
    a.year === b.year || (b.year === a.year + 1 && (a.month > b.month || (a.month === b.month && a.day >= b.day)));
  if (withinAYear) {
    let yearLength = 365;
    if (a.year === b.year && isLeapYear(a.year)) yearLength = 366;
    else if (a.year !== b.year) {
      const feb29InRange =
        (isLeapYear(a.year) && (a.month < 2 || (a.month === 2 && a.day <= 29))) ||
        (isLeapYear(b.year) && (b.month > 2 || (b.month === 2 && b.day === 29)));
      if (feb29InRange) yearLength = 366;
    }
    return days / yearLength;
  }
  const years = b.year - a.year + 1;
  const total = (serialFromDate(b.year + 1, 1, 1) as number) - (serialFromDate(a.year, 1, 1) as number);
  return days / (total / years);
}

/**
 * Fraction of a year between two serials (YEARFRAC), for day-count `basis`:
 *   0 US 30/360, 1 actual/actual, 2 actual/360, 3 actual/365, 4 European 30/360.
 * The order of the dates does not matter. #NUM! for another basis.
 */
export function yearFraction(start: number, end: number, basis: number): number | FormulaError {
  let s = Math.floor(start);
  let e = Math.floor(end);
  if (s > e) [s, e] = [e, s];
  const a = dateFromSerial(s);
  if (isError(a)) return a;
  const b = dateFromSerial(e);
  if (isError(b)) return b;
  switch (basis) {
    case 0: {
      let startDay = a.day;
      let endDay = b.day;
      if (startDay === 31 && endDay === 31) {
        startDay = 30;
        endDay = 30;
      } else if (startDay === 31) {
        startDay = 30;
      } else if (startDay === 30 && endDay === 31) {
        endDay = 30;
      } else if (isLastDayOfFebruary(a) && isLastDayOfFebruary(b)) {
        startDay = 30;
        endDay = 30;
      } else if (isLastDayOfFebruary(a)) {
        startDay = 30;
      }
      return ((b.year - a.year) * 360 + (b.month - a.month) * 30 + (endDay - startDay)) / 360;
    }
    case 1:
      return actualActual(s, e, a, b);
    case 2:
      return (e - s) / 360;
    case 3:
      return (e - s) / 365;
    case 4: {
      const d = days360(s, e, true);
      return isError(d) ? d : d / 360;
    }
    default:
      return err.num;
  }
}
