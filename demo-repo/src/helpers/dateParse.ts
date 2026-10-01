import type { FormulaError } from '../core/value';
import { NotImplementedError } from '../core/errors';

/**
 * Serial number of a date written as text (DATEVALUE). Accepted forms, with an
 * optional trailing time that is ignored:
 *   2020-01-15 · 2020/1/15 · 1/15/2020 · 1/15/20 · 15-Jan-2020 · 15 January 2020 ·
 *   Jan 15, 2020 · January 15 2020
 * Two-digit years 00-29 are 20xx, 30-99 are 19xx. Invalid dates (2020-02-30) and
 * anything else give #VALUE!.
 */
export function parseDateText(text: string): number | FormulaError {
  throw new NotImplementedError('parseDateText (src/helpers/dateParse.ts)');
}

/**
 * Fraction of a day for a time written as text (TIMEVALUE): "14:30", "14:30:15",
 * "2:30 PM", "2:30:15 am", optionally preceded by a date that is ignored.
 * Hours must be < 24 (1..12 with AM/PM), minutes and seconds < 60; otherwise #VALUE!.
 */
export function parseTimeText(text: string): number | FormulaError {
  throw new NotImplementedError('parseTimeText (src/helpers/dateParse.ts)');
}
