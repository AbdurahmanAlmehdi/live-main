import type { FormulaError } from '../core/value';
import { err, isError } from '../core/errors';
import { formatGeneral } from '../core/coerce';
import { roundHalfAwayFromZero } from './rounding';
import { dateFromSerial } from './dateSerial';
import { dayOfWeek } from './weekday';

/**
 * Number format codes, the subset TEXT supports:
 *   - "General";
 *   - number codes with 0 # ? placeholders, "." decimals, "," thousands separators (a
 *     trailing "," divides by 1000), "%" (multiplies by 100), scientific "E+00" / "E-00";
 *   - date/time codes yyyy yy mmmm mmm mm m dddd ddd dd d hh h mm ss (m/mm after h or
 *     before s means minutes) and AM/PM or A/P;
 *   - up to three sections "positive;negative;zero" (a negative number formatted with its
 *     own section loses its minus sign);
 *   - literal text in "double quotes" or after a backslash, and the characters $ - + / ( ) : space.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The section with quoted and backslash-escaped literals removed. */
function unquoted(section: string): string {
  return section.replace(/"[^"]*"|\\./g, '');
}

function splitSections(pattern: string): string[] {
  const sections: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '"') quoted = !quoted;
    if (ch === '\\' && !quoted && i + 1 < pattern.length) {
      current += ch + pattern[++i];
      continue;
    }
    if (ch === ';' && !quoted) {
      sections.push(current);
      current = '';
    } else current += ch;
  }
  sections.push(current);
  return sections;
}

function isDateCode(section: string): boolean {
  return /[ymdhs]|AM\/PM|A\/P/i.test(unquoted(section));
}

// ---------------------------------------------------------------- dates

type DateToken = { kind: 'literal'; text: string } | { kind: 'part'; code: string };

function dateTokens(section: string): DateToken[] {
  const out: DateToken[] = [];
  const re = /"([^"]*)"|\\(.)|(AM\/PM|am\/pm|A\/P|a\/p)|(y+|m+|d+|h+|s+)|(.)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    if (m[1] !== undefined) out.push({ kind: 'literal', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'literal', text: m[2] });
    else if (m[3] !== undefined) out.push({ kind: 'part', code: m[3] });
    else if (m[4] !== undefined) out.push({ kind: 'part', code: m[4].toLowerCase() });
    else out.push({ kind: 'literal', text: m[5] });
  }
  // "m" / "mm" means minutes right after an hour code or right before a seconds code.
  const parts = out.filter((t): t is { kind: 'part'; code: string } => t.kind === 'part');
  parts.forEach((t, i) => {
    if (t.code.startsWith('m') && t.code.length <= 2) {
      const prev = parts[i - 1]?.code ?? '';
      const next = parts[i + 1]?.code ?? '';
      if (prev.startsWith('h') || next.startsWith('s')) t.code = t.code === 'm' ? 'n' : 'nn';
    }
  });
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(serial: number, section: string): string | FormulaError {
  const date = dateFromSerial(serial);
  if (isError(date)) return date;
  const seconds = Math.round((serial - Math.floor(serial)) * 86400) % 86400;
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  const second = seconds % 60;
  const tokens = dateTokens(section);
  const twelveHour = tokens.some((t) => t.kind === 'part' && t.code.includes('/'));
  let out = '';
  for (const t of tokens) {
    if (t.kind === 'literal') {
      out += t.text;
      continue;
    }
    const c = t.code;
    if (c.includes('/')) {
      const pm = hour >= 12;
      const [am, p] = c.split('/');
      out += pm ? p : am;
    } else if (c.startsWith('y')) out += c.length <= 2 ? pad2(date.year % 100) : String(date.year);
    else if (c === 'm') out += String(date.month);
    else if (c === 'mm') out += pad2(date.month);
    else if (c === 'mmm') out += MONTH_NAMES[date.month - 1].slice(0, 3);
    else if (c === 'mmmmm') out += MONTH_NAMES[date.month - 1][0];
    else if (c.startsWith('m')) out += MONTH_NAMES[date.month - 1];
    else if (c === 'd') out += String(date.day);
    else if (c === 'dd') out += pad2(date.day);
    else if (c === 'ddd') out += DAY_NAMES[dayOfWeek(serial)].slice(0, 3);
    else if (c.startsWith('d')) out += DAY_NAMES[dayOfWeek(serial)];
    else if (c.startsWith('h')) {
      const h = twelveHour ? hour % 12 || 12 : hour;
      out += c.length === 1 ? String(h) : pad2(h);
    } else if (c === 'n') out += String(minute);
    else if (c === 'nn') out += pad2(minute);
    else if (c.startsWith('s')) out += c.length === 1 ? String(second) : pad2(second);
  }
  return out;
}

// ---------------------------------------------------------------- numbers

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

type Piece = { kind: 'literal'; text: string } | { kind: 'digits'; text: string } | { kind: 'exponent'; sign: string; zeros: number };

function numberPieces(section: string): Piece[] {
  const pieces: Piece[] = [];
  const re = /"([^"]*)"|\\(.)|[Ee]([+-])(0+)|([0#?.,]+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    if (m[1] !== undefined) pieces.push({ kind: 'literal', text: m[1] });
    else if (m[2] !== undefined) pieces.push({ kind: 'literal', text: m[2] });
    else if (m[3] !== undefined) pieces.push({ kind: 'exponent', sign: m[3], zeros: m[4].length });
    else if (m[5] !== undefined) pieces.push({ kind: 'digits', text: m[5] });
    else pieces.push({ kind: 'literal', text: m[6] });
  }
  return pieces;
}

function formatNumberSection(value: number, section: string): string {
  const pieces = numberPieces(section);
  const first = pieces.findIndex((p) => p.kind !== 'literal');
  let last = -1;
  pieces.forEach((p, i) => {
    if (p.kind !== 'literal') last = i;
  });
  const literalText = (ps: Piece[]) => ps.map((p) => (p.kind === 'literal' ? p.text : '')).join('');
  const prefix = literalText(first < 0 ? pieces : pieces.slice(0, first));
  const suffix = first < 0 ? '' : literalText(pieces.slice(last + 1));
  const codes = pieces.map((p) => (p.kind === 'digits' ? p.text : '')).join('');
  const exponent = pieces.find((p): p is Extract<Piece, { kind: 'exponent' }> => p.kind === 'exponent');
  const percents = (section.match(/%/g) ?? []).length;

  const [intCodesRaw, fracCodes = ''] = codes.split('.');
  const trailingCommas = /,*$/.exec(intCodesRaw)![0].length;
  const intCodes = intCodesRaw.slice(0, intCodesRaw.length - trailingCommas);
  const grouping = intCodes.includes(',');
  const fracPlaces = fracCodes.replace(/,/g, '').length;
  let scaled = (Math.abs(value) * Math.pow(100, percents)) / Math.pow(1000, trailingCommas);

  let exponentText = '';
  if (exponent) {
    let e = scaled === 0 ? 0 : Math.floor(Math.log10(scaled));
    scaled = Number((scaled / Math.pow(10, e)).toPrecision(15));
    if (roundHalfAwayFromZero(scaled, fracPlaces) >= 10) {
      scaled /= 10;
      e += 1;
    }
    const sign = e < 0 ? '-' : exponent.sign === '+' ? '+' : '';
    exponentText = `E${sign}${String(Math.abs(e)).padStart(exponent.zeros, '0')}`;
  }

  const rounded = roundHalfAwayFromZero(scaled, fracPlaces);
  const [intDigitsRaw, fracDigitsRaw = ''] = rounded.toFixed(fracPlaces).split('.');
  const minInt = (intCodes.match(/0/g) ?? []).length;
  let intDigits = intDigitsRaw === '0' && minInt === 0 ? '' : intDigitsRaw.padStart(minInt, '0');
  if (grouping) intDigits = groupThousands(intDigits);
  // optional decimal places (# and ?) drop trailing zeros; ? keeps their width as spaces
  let fracDigits = fracDigitsRaw;
  for (let i = fracPlaces - 1; i >= 0 && fracCodes[i] !== '0' && fracDigits.endsWith('0'); i--) {
    fracDigits = fracDigits.slice(0, -1) + (fracCodes[i] === '?' ? ' ' : '');
  }
  const point = codes.includes('.') ? '.' : '';
  return `${prefix}${intDigits}${point}${fracDigits}${exponentText}${suffix}`;
}

/**
 * Formats a number with a format code (see the module comment). Returns #VALUE! for a
 * format code it cannot use (an empty code formats as "").
 */
export function formatWithPattern(value: number, pattern: string): string | FormulaError {
  if (pattern === '') return '';
  if (/^general$/i.test(pattern.trim())) return formatGeneral(value);
  const sections = splitSections(pattern);
  if (sections.length > 4) return err.value;
  let section = sections[0];
  let showMinus = value < 0;
  if (value < 0 && sections.length >= 2 && sections[1] !== '') {
    section = sections[1];
    showMinus = false;
  } else if (value === 0 && sections.length >= 3) {
    section = sections[2];
  }
  if (isDateCode(section)) {
    if (value < 0) return err.value;
    return formatDate(value, section);
  }
  const text = formatNumberSection(value, section);
  return showMinus && /[1-9]/.test(text) ? `-${text}` : text;
}
