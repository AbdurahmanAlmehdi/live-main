import type { FormulaError } from '../core/value';
import { err, isError } from '../core/errors';
import { serialFromDate } from './dateSerial';
import { serialFromTime } from './timeOfDay';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** 1..12 for a month name or its abbreviation of at least three letters ("Jan", "Sept", "March"). */
function monthNumber(name: string): number | undefined {
  const lower = name.toLowerCase();
  if (lower.length < 3) return undefined;
  const index = MONTHS.findIndex((m) => m.startsWith(lower));
  return index < 0 ? undefined : index + 1;
}

function expandYear(text: string): number {
  const y = Number(text);
  if (text.length > 2) return y;
  return y < 30 ? 2000 + y : 1900 + y;
}

const TIME_PART = /\s+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s*[AaPp][Mm])?$/;

/**
 * Serial number of a date written as text (DATEVALUE). Accepted forms, with an
 * optional trailing time that is ignored:
 *   2020-01-15 · 2020/1/15 · 1/15/2020 · 1/15/20 · 15-Jan-2020 · 15 January 2020 ·
 *   Jan 15, 2020 · January 15 2020
 * Two-digit years 00-29 are 20xx, 30-99 are 19xx. Invalid dates (2020-02-30) and
 * anything else give #VALUE!.
 */
export function parseDateText(text: string): number | FormulaError {
  const s = text.trim().replace(TIME_PART, '');
  let parts: [number, number, number] | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s))) parts = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) parts = [expandYear(m[3]), Number(m[1]), Number(m[2])];
  else if ((m = /^(\d{1,2})[-\s]([A-Za-z]+)[-\s,]+(\d{2}|\d{4})$/.exec(s))) {
    const month = monthNumber(m[2]);
    if (month) parts = [expandYear(m[3]), month, Number(m[1])];
  } else if ((m = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/.exec(s))) {
    const month = monthNumber(m[1]);
    if (month) parts = [expandYear(m[3]), month, Number(m[2])];
  }
  if (!parts) return err.value;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return err.value;
  if (year < 1900) return err.value;
  const serial = serialFromDate(year, month, day);
  return isError(serial) ? err.value : serial;
}

/**
 * Fraction of a day for a time written as text (TIMEVALUE): "14:30", "14:30:15",
 * "2:30 PM", "2:30:15 am", optionally preceded by a date that is ignored.
 * Hours must be < 24 (1..12 with AM/PM), minutes and seconds < 60; otherwise #VALUE!.
 */
export function parseTimeText(text: string): number | FormulaError {
  const m = /(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?(?:\s*([AaPp])[Mm])?$/.exec(text.trim());
  if (!m) return err.value;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] === undefined ? 0 : Number(m[3]);
  if (minute > 59 || second >= 60) return err.value;
  if (m[4]) {
    if (hour < 1 || hour > 12) return err.value;
    hour = (hour % 12) + (m[4].toLowerCase() === 'p' ? 12 : 0);
  } else if (hour > 23) return err.value;
  const prefix = text.trim().slice(0, m.index).trim();
  if (prefix !== '' && isError(parseDateText(prefix))) return err.value;
  return serialFromTime(hour, minute, second);
}
