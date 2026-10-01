import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * The same day `months` months later (EDATE); a day that does not exist in the target
 * month becomes its last day (Jan 31 + 1 month = Feb 28/29). `months` must be an integer.
 * #NUM! when the input or the result is out of range.
 */
export function addMonths(serial: number, months: number): number | FormulaError {
  throw new NotImplementedError('addMonths (src/helpers/addMonths.ts)');
}

/** Serial of the last day of the month `months` months after the serial's month (EOMONTH). */
export function endOfMonth(serial: number, months: number): number | FormulaError {
  throw new NotImplementedError('endOfMonth (src/helpers/addMonths.ts)');
}
