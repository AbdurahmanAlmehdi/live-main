/**
 * Traps: function tasks whose most direct implementation changes shared behaviour (a
 * helper's or core's default) that already-landed functions rely on. The diff merges
 * cleanly and the trap's own tests pass, but dependents break.
 *
 * Each trap has two solutions, both writing the function module and its registry line:
 *   - reference: extends the shared code without changing its defaults (an option or a new
 *     export), so every dependent stays green;
 *   - naive: changes the shared default, which is what bench/solutions/<id>.naive.json holds.
 *
 * The function's reference source is bench/reference/functions/<category>/<FILE>.ts; the
 * naive source is derived from it with `naiveFunction` replacements.
 */
import type { Op } from '../src/bank.ts';

type Edit = Extract<Op, { op: 'edit' }>;

export interface TrapDef {
  id: string;
  /** The spreadsheet function the trap implements (spec in defs/functions). */
  fn: string;
  title: string;
  ask: string;
  /** The shared module whose behaviour is at stake. */
  shared: string;
  reference: Edit[];
  naive: Edit[];
  /** [from, to] replacements turning the reference function source into the naive one. */
  naiveFunction: [string, string][];
}

const edit = (path: string, oldString: string, newString: string): Edit => ({ op: 'edit', path, oldString, newString });

export const TRAPS: TrapDef[] = [
  {
    id: 'trap-AVERAGEA',
    fn: 'AVERAGEA',
    title: 'Implement AVERAGEA',
    ask: 'Implement AVERAGEA: like AVERAGE, but inside arrays text counts as 0 and TRUE/FALSE as 1/0.',
    shared: 'src/core/args.ts',
    reference: [
      edit('src/core/args.ts', `  /** Empty arguments (e.g. SUM(1,,2)): 'zero' (default) counts them as 0, 'ignore' skips them. */
  directEmpty?: 'zero' | 'ignore';
}`, `  /** Empty arguments (e.g. SUM(1,,2)): 'zero' (default) counts them as 0, 'ignore' skips them. */
  directEmpty?: 'zero' | 'ignore';
  /**
   * Values inside arrays/ranges: 'numbers' (default) counts only numbers; 'all' also counts
   * text as 0 and booleans as 1 / 0, as the A-functions (AVERAGEA, ...) do.
   */
  rangeValues?: 'numbers' | 'all';
}`),
      edit('src/core/args.ts', `  const { directText = 'coerce', directBooleans = 'coerce', directEmpty = 'zero' } = opts;`, `  const { directText = 'coerce', directBooleans = 'coerce', directEmpty = 'zero', rangeValues = 'numbers' } = opts;`),
      edit('src/core/args.ts', `          if (typeof cell === 'number') out.push(cell);`, `          if (typeof cell === 'number') out.push(cell);
          else if (rangeValues === 'all' && typeof cell === 'boolean') out.push(cell ? 1 : 0);
          else if (rangeValues === 'all' && typeof cell === 'string') out.push(0);`),
    ],
    naive: [
      edit('src/core/args.ts', `          if (typeof cell === 'number') out.push(cell);`, `          if (typeof cell === 'number') out.push(cell);
          else if (typeof cell === 'boolean') out.push(cell ? 1 : 0);
          else if (typeof cell === 'string') out.push(0);`),
    ],
    naiveFunction: [[`collectNumbers(args, { rangeValues: 'all' })`, 'collectNumbers(args)']],
  },
  {
    id: 'trap-VAR.P',
    fn: 'VAR.P',
    title: 'Implement VAR.P',
    ask: 'Implement VAR.P, the population variance (divide by n).',
    shared: 'src/helpers/variance.ts',
    reference: [
      edit('src/helpers/variance.ts', `/** Sample variance (n - 1 denominator); #DIV/0! for fewer than two values. */
export function variance(values: readonly number[]): number | FormulaError {
  if (values.length < 2) return err.div0;
  return sumOfSquaredDeviations(values) / (values.length - 1);
}`, `export interface VarianceOptions {
  /** Divide by n (population variance) instead of n - 1 (sample variance). */
  population?: boolean;
}

/**
 * Sample variance (n - 1 denominator), or the population variance (n) with
 * { population: true }. #DIV/0! for fewer than two values (one for the population).
 */
export function variance(values: readonly number[], options: VarianceOptions = {}): number | FormulaError {
  const population = options.population ?? false;
  const n = values.length;
  if (n < (population ? 1 : 2)) return err.div0;
  return sumOfSquaredDeviations(values) / (population ? n : n - 1);
}`),
    ],
    naive: [
      edit('src/helpers/variance.ts', `/** Sample variance (n - 1 denominator); #DIV/0! for fewer than two values. */
export function variance(values: readonly number[]): number | FormulaError {
  if (values.length < 2) return err.div0;
  return sumOfSquaredDeviations(values) / (values.length - 1);
}`, `/** Population variance (n denominator); #DIV/0! for an empty list. */
export function variance(values: readonly number[]): number | FormulaError {
  if (values.length < 1) return err.div0;
  return sumOfSquaredDeviations(values) / values.length;
}`),
    ],
    naiveFunction: [['variance(numbers, { population: true })', 'variance(numbers)']],
  },
  {
    id: 'trap-SKEW.P',
    fn: 'SKEW.P',
    title: 'Implement SKEW.P',
    ask: 'Implement SKEW.P, the population skewness of a data set.',
    shared: 'src/helpers/shape.ts',
    reference: [
      edit('src/helpers/shape.ts', `/**
 * Sample skewness, n / ((n-1)(n-2)) * Σ((x - mean) / s)^3 with s the sample standard
 * deviation. #DIV/0! for fewer than three values or zero spread.
 */
export function skewness(values: readonly number[]): number | FormulaError {
  const n = values.length;
  if (n < 3) return err.div0;`, `export interface SkewnessOptions {
  /** Population skewness, Σ((x - mean) / σ)^3 / n with σ the population standard deviation. */
  population?: boolean;
}

/**
 * Sample skewness, n / ((n-1)(n-2)) * Σ((x - mean) / s)^3 with s the sample standard
 * deviation, or the population skewness with { population: true }. #DIV/0! for fewer
 * than three values (one for the population) or zero spread.
 */
export function skewness(values: readonly number[], options: SkewnessOptions = {}): number | FormulaError {
  const n = values.length;
  if (options.population) {
    if (n < 1) return err.div0;
    const sigma = Math.sqrt(sumOfSquaredDeviations(values) / n);
    if (sigma === 0) return err.div0;
    return standardizedPowerSum(values, 3, sigma, mean(values) as number) / n;
  }
  if (n < 3) return err.div0;`),
    ],
    naive: [
      edit('src/helpers/shape.ts', `/**
 * Sample skewness, n / ((n-1)(n-2)) * Σ((x - mean) / s)^3 with s the sample standard
 * deviation. #DIV/0! for fewer than three values or zero spread.
 */
export function skewness(values: readonly number[]): number | FormulaError {
  const n = values.length;
  if (n < 3) return err.div0;
  const sd = Math.sqrt(sumOfSquaredDeviations(values) / (n - 1));
  if (sd === 0) return err.div0;
  const m = mean(values) as number;
  return (n / ((n - 1) * (n - 2))) * standardizedPowerSum(values, 3, sd, m);
}`, `/**
 * Population skewness, Σ((x - mean) / σ)^3 / n with σ the population standard
 * deviation. #DIV/0! for an empty list or zero spread.
 */
export function skewness(values: readonly number[]): number | FormulaError {
  const n = values.length;
  if (n < 1) return err.div0;
  const sigma = Math.sqrt(sumOfSquaredDeviations(values) / n);
  if (sigma === 0) return err.div0;
  return standardizedPowerSum(values, 3, sigma, mean(values) as number) / n;
}`),
    ],
    naiveFunction: [['skewness(numbers, { population: true })', 'skewness(numbers)']],
  },
  {
    id: 'trap-PERCENTILE.EXC',
    fn: 'PERCENTILE.EXC',
    title: 'Implement PERCENTILE.EXC',
    ask: 'Implement PERCENTILE.EXC, the exclusive percentile (0 < k < 1, rank k·(n+1)).',
    shared: 'src/helpers/quantile.ts',
    reference: [
      edit('src/helpers/quantile.ts', `  if (fraction === 0) return sorted[lower];
  return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}`, `  if (fraction === 0) return sorted[lower];
  return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

/**
 * Exclusive percentile (PERCENTILE.EXC): interpolates linearly at the 1-based rank
 * k * (n + 1). #NUM! when that rank falls outside [1, n] or the list is empty.
 */
export function percentileExclusive(values: readonly number[], k: number): number | FormulaError {
  const n = values.length;
  const rank = k * (n + 1);
  if (n === 0 || k <= 0 || k >= 1 || rank < 1 || rank > n) return err.num;
  const sorted = [...values].sort((a, b) => a - b);
  const lower = Math.floor(rank);
  const fraction = rank - lower;
  if (fraction === 0) return sorted[lower - 1];
  return sorted[lower - 1] + fraction * (sorted[lower] - sorted[lower - 1]);
}`),
    ],
    naive: [
      edit('src/helpers/quantile.ts', `/**
 * Inclusive percentile (PERCENTILE.INC): sorts the values and interpolates linearly at
 * rank k * (n - 1). k must be in [0, 1] and the list non-empty, otherwise #NUM!.
 */
export function percentileInclusive(values: readonly number[], k: number): number | FormulaError {
  if (values.length === 0 || k < 0 || k > 1) return err.num;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = k * (sorted.length - 1);
  const lower = Math.floor(rank);
  const fraction = rank - lower;
  if (fraction === 0) return sorted[lower];
  return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}`, `/**
 * Percentile: sorts the values and interpolates linearly at the 1-based rank k * (n + 1).
 * #NUM! when that rank falls outside [1, n] or the list is empty.
 */
export function percentileInclusive(values: readonly number[], k: number): number | FormulaError {
  const n = values.length;
  const rank = k * (n + 1);
  if (n === 0 || k <= 0 || k >= 1 || rank < 1 || rank > n) return err.num;
  const sorted = [...values].sort((a, b) => a - b);
  const lower = Math.floor(rank);
  const fraction = rank - lower;
  if (fraction === 0) return sorted[lower - 1];
  return sorted[lower - 1] + fraction * (sorted[lower] - sorted[lower - 1]);
}`),
    ],
    naiveFunction: [
      ['import { percentileExclusive }', 'import { percentileInclusive }'],
      ['return percentileExclusive(numbers, k);', 'return percentileInclusive(numbers, k);'],
    ],
  },
  {
    id: 'trap-RANK.AVG',
    fn: 'RANK.AVG',
    title: 'Implement RANK.AVG',
    ask: 'Implement RANK.AVG: like RANK.EQ, but tied numbers get the average of the ranks they span.',
    shared: 'src/helpers/rank.ts',
    reference: [
      edit('src/helpers/rank.ts', `/**
 * Rank of \`value\` within \`values\` (RANK.EQ): 1 for the largest when descending, 1 for the
 * smallest when ascending. Ties share the best rank. #N/A when \`value\` is not in the list.
 */
export function rankOf(value: number, values: readonly number[], ascending: boolean): number | FormulaError {
  if (!values.includes(value)) return err.na;
  let better = 0;
  for (const v of values) {
    if (ascending ? v < value : v > value) better++;
  }
  return better + 1;
}`, `export interface RankOptions {
  /** How tied values are ranked: 'best' (default, RANK.EQ) or 'average' (RANK.AVG). */
  ties?: 'best' | 'average';
}

/**
 * Rank of \`value\` within \`values\`: 1 for the largest when descending, 1 for the smallest
 * when ascending. Ties share the best rank, or the average of their ranks with
 * { ties: 'average' }. #N/A when \`value\` is not in the list.
 */
export function rankOf(value: number, values: readonly number[], ascending: boolean, options: RankOptions = {}): number | FormulaError {
  if (!values.includes(value)) return err.na;
  let better = 0;
  let equal = 0;
  for (const v of values) {
    if (v === value) equal++;
    else if (ascending ? v < value : v > value) better++;
  }
  return options.ties === 'average' ? better + (equal + 1) / 2 : better + 1;
}`),
    ],
    naive: [
      edit('src/helpers/rank.ts', `/**
 * Rank of \`value\` within \`values\` (RANK.EQ): 1 for the largest when descending, 1 for the
 * smallest when ascending. Ties share the best rank. #N/A when \`value\` is not in the list.
 */
export function rankOf(value: number, values: readonly number[], ascending: boolean): number | FormulaError {
  if (!values.includes(value)) return err.na;
  let better = 0;
  for (const v of values) {
    if (ascending ? v < value : v > value) better++;
  }
  return better + 1;
}`, `/**
 * Rank of \`value\` within \`values\`: 1 for the largest when descending, 1 for the smallest
 * when ascending. Tied values get the average of the ranks they span. #N/A when \`value\`
 * is not in the list.
 */
export function rankOf(value: number, values: readonly number[], ascending: boolean): number | FormulaError {
  if (!values.includes(value)) return err.na;
  let better = 0;
  let equal = 0;
  for (const v of values) {
    if (v === value) equal++;
    else if (ascending ? v < value : v > value) better++;
  }
  return better + (equal + 1) / 2;
}`),
    ],
    naiveFunction: [[`rankOf(n, numbers, order !== 0, { ties: 'average' })`, 'rankOf(n, numbers, order !== 0)']],
  },
  {
    id: 'trap-ISOWEEKNUM',
    fn: 'ISOWEEKNUM',
    title: 'Implement ISOWEEKNUM',
    ask: 'Implement ISOWEEKNUM, the ISO 8601 week number of a date.',
    shared: 'src/helpers/weekday.ts',
    reference: [
      edit('src/helpers/weekday.ts', `/**
 * Week of the year in "system 1": the week containing January 1 is week 1, and weeks
 * start on \`weekStart\` (0 = Sunday .. 6 = Saturday).
 */`, `/**
 * ISO 8601 week number ("system 2"): weeks start on Monday and week 1 is the week that
 * contains the year's first Thursday, so early January can belong to the previous year's
 * week 52/53 and late December to week 1.
 */
export function isoWeekOfYear(serial: number): number | FormulaError {
  const day = Math.floor(serial);
  const thursday = day - ((dayOfWeek(day) + 6) % 7) + 3;
  const parts = dateFromSerial(thursday);
  if (isError(parts)) return parts;
  const jan1 = serialFromDate(parts.year, 1, 1) as number;
  return Math.floor((thursday - jan1) / 7) + 1;
}

/**
 * Week of the year in "system 1": the week containing January 1 is week 1, and weeks
 * start on \`weekStart\` (0 = Sunday .. 6 = Saturday).
 */`),
    ],
    naive: [
      edit('src/helpers/weekday.ts', `/**
 * Week of the year in "system 1": the week containing January 1 is week 1, and weeks
 * start on \`weekStart\` (0 = Sunday .. 6 = Saturday).
 */
export function weekOfYear(serial: number, weekStart: number): number | FormulaError {
  const parts = dateFromSerial(serial);
  if (isError(parts)) return parts;`, `/**
 * Week of the year: the week containing January 1 is week 1, and weeks start on
 * \`weekStart\` (0 = Sunday .. 6 = Saturday). Weeks starting on Monday follow ISO 8601
 * (week 1 contains the year's first Thursday).
 */
export function weekOfYear(serial: number, weekStart: number): number | FormulaError {
  const parts = dateFromSerial(serial);
  if (isError(parts)) return parts;
  if (weekStart === 1) {
    const day = Math.floor(serial);
    const thursday = day - ((dayOfWeek(day) + 6) % 7) + 3;
    const thursdayParts = dateFromSerial(thursday);
    if (isError(thursdayParts)) return thursdayParts;
    return Math.floor((thursday - (serialFromDate(thursdayParts.year, 1, 1) as number)) / 7) + 1;
  }`),
    ],
    naiveFunction: [
      ['import { isoWeekOfYear }', 'import { weekOfYear }'],
      ['return isoWeekOfYear(serial);', 'return weekOfYear(serial, 1);'],
    ],
  },
  {
    id: 'trap-SEARCH',
    fn: 'SEARCH',
    title: 'Implement SEARCH',
    ask: 'Implement SEARCH: the position of one text inside another, ignoring case, with * ? ~ wildcards.',
    shared: 'src/helpers/wildcard.ts',
    reference: [
      edit('src/helpers/wildcard.ts', `/** A case-insensitive RegExp that matches whole texts against the pattern. */
export function wildcardToRegExp(pattern: string): RegExp {`, `export interface WildcardOptions {
  /** Match the whole text (default) or find the pattern anywhere in it. */
  anchored?: boolean;
}

/** A case-insensitive RegExp that matches whole texts (or, unanchored, any part) against the pattern. */
export function wildcardToRegExp(pattern: string, options: WildcardOptions = {}): RegExp {`),
      edit('src/helpers/wildcard.ts', '  return new RegExp(`^${source}$`, \'i\');', '  return new RegExp(options.anchored === false ? source : `^${source}$`, \'i\');'),
    ],
    naive: [
      edit('src/helpers/wildcard.ts', `/** A case-insensitive RegExp that matches whole texts against the pattern. */`, `/** A case-insensitive RegExp that finds the pattern in a text. */`),
      edit('src/helpers/wildcard.ts', '  return new RegExp(`^${source}$`, \'i\');', "  return new RegExp(source, 'i');"),
    ],
    naiveFunction: [['wildcardToRegExp(needle, { anchored: false })', 'wildcardToRegExp(needle)']],
  },
  {
    id: 'trap-XLOOKUP',
    fn: 'XLOOKUP',
    title: 'Implement XLOOKUP',
    ask: 'Implement XLOOKUP (exact, next-smaller, next-larger and wildcard match modes; forward and reverse search).',
    shared: 'src/helpers/lookupExact.ts',
    reference: [
      edit('src/helpers/lookupExact.ts', ` *   - text matches case-insensitively, and a needle with wildcards (* ? ~) is matched
 *     as a pattern against text cells.
 */
export function findExact(needle: Scalar, haystack: readonly Scalar[]): number {
  if (typeof needle === 'string' && hasWildcards(needle)) {`, ` *   - text matches case-insensitively, and a needle with wildcards (* ? ~) is matched
 *     as a pattern against text cells unless { wildcards: false } is given.
 */
export function findExact(needle: Scalar, haystack: readonly Scalar[], options: { wildcards?: boolean } = {}): number {
  if (options.wildcards !== false && typeof needle === 'string' && hasWildcards(needle)) {`),
    ],
    naive: [
      edit('src/helpers/lookupExact.ts', ` *   - text matches case-insensitively, and a needle with wildcards (* ? ~) is matched
 *     as a pattern against text cells.
 */
export function findExact(needle: Scalar, haystack: readonly Scalar[]): number {
  if (typeof needle === 'string' && hasWildcards(needle)) {
    const pattern = wildcardToRegExp(needle);
    return haystack.findIndex((cell) => typeof cell === 'string' && pattern.test(cell));
  }
  return`, ` *   - text matches case-insensitively; * and ? are ordinary characters.
 */
export function findExact(needle: Scalar, haystack: readonly Scalar[]): number {
  return`),
      edit('src/helpers/lookupExact.ts', `import { hasWildcards, wildcardToRegExp } from './wildcard';\n`, ''),
    ],
    naiveFunction: [
      ["import { findExact } from '../../helpers/lookupExact';", "import { findExact } from '../../helpers/lookupExact';\nimport { wildcardToRegExp } from '../../helpers/wildcard';"],
      ['index = findExact(needle, ordered, { wildcards: false });', 'index = findExact(needle, ordered);'],
      ['else if (matchMode === 2) index = findExact(needle, ordered);', "else if (matchMode === 2) {\n      const pattern = wildcardToRegExp(String(needle));\n      index = ordered.findIndex((cell) => typeof cell === 'string' && pattern.test(cell));\n    }"],
    ],
  },
  {
    id: 'trap-DECIMAL',
    fn: 'DECIMAL',
    title: 'Implement DECIMAL',
    ask: 'Implement DECIMAL: convert text written in any base from 2 to 36 (up to 255 characters) to a number.',
    shared: 'src/helpers/radixParse.ts',
    reference: [
      edit('src/helpers/radixParse.ts', ` *   - "" is 0.
 */
export function parseRadix(text: string, radix: number): number | FormulaError {
  const digits = text.trim().toUpperCase();
  if (digits.length > 10) return err.num;`, ` *   - "" is 0.
 * DECIMAL-style parsing passes { signed: false, maxDigits: 255 }.
 */
export function parseRadix(text: string, radix: number, options: { signed?: boolean; maxDigits?: number } = {}): number | FormulaError {
  const { signed = true, maxDigits = 10 } = options;
  const digits = text.trim().toUpperCase();
  if (digits.length > maxDigits) return err.num;`),
      edit('src/helpers/radixParse.ts', `  if (digits.length === 10 && (radix === 2 || radix === 8 || radix === 16)) {`, `  if (signed && digits.length === 10 && (radix === 2 || radix === 8 || radix === 16)) {`),
    ],
    naive: [
      edit('src/helpers/radixParse.ts', `  const digits = text.trim().toUpperCase();
  if (digits.length > 10) return err.num;`, `  const digits = text.trim().toUpperCase();
  if (digits.length > 255) return err.num;`),
      edit('src/helpers/radixParse.ts', `  if (digits.length === 10 && (radix === 2 || radix === 8 || radix === 16)) {
    const top = parseInt(digits[0], radix);
    if (top >= radix / 2) value -= Math.pow(radix, 10);
  }
`, ''),
    ],
    naiveFunction: [['parseRadix(text, radix, { signed: false, maxDigits: 255 })', 'parseRadix(text, radix)']],
  },
  {
    id: 'trap-BASE',
    fn: 'BASE',
    title: 'Implement BASE',
    ask: 'Implement BASE: write a non-negative integer in any base from 2 to 36, zero-padded to a minimum length.',
    shared: 'src/helpers/radixFormat.ts',
    reference: [
      edit('src/helpers/radixFormat.ts', `  if (places < 1 || places > 10 || digits.length > places) return err.num;
  return digits.padStart(places, '0');
}`, `  if (places < 1 || places > 10 || digits.length > places) return err.num;
  return digits.padStart(places, '0');
}

/**
 * A non-negative integer in base 2..36 (upper-case digits), zero-padded to at least
 * \`minLength\` characters; never fails for long results (BASE).
 */
export function formatUnsigned(n: number, radix: number, minLength = 0): string {
  return n.toString(radix).toUpperCase().padStart(minLength, '0');
}`),
    ],
    naive: [
      edit('src/helpers/radixFormat.ts', `  const limit = Math.pow(radix, 10) / 2;
  if (n < -limit || n >= limit) return err.num;
  if (n < 0) return (Math.pow(radix, 10) + n).toString(radix).toUpperCase();
  const digits = n.toString(radix).toUpperCase();
  if (places === undefined) return digits;
  if (places < 1 || places > 10 || digits.length > places) return err.num;
  return digits.padStart(places, '0');`, `  const limit = Math.pow(radix, 10) / 2;
  if (n < -limit) return err.num;
  if (n < 0) return (Math.pow(radix, 10) + n).toString(radix).toUpperCase();
  const digits = n.toString(radix).toUpperCase();
  return places === undefined ? digits : digits.padStart(places, '0');`),
    ],
    naiveFunction: [
      ["import { formatUnsigned } from '../../helpers/radixFormat';", "import { formatRadix } from '../../helpers/radixFormat';"],
      ['return formatUnsigned(n, radix, minLength);', 'return formatRadix(n, radix, minLength);'],
    ],
  },
  {
    id: 'trap-INT',
    fn: 'INT',
    title: 'Implement INT',
    ask: 'Implement INT: round a number down to the nearest integer (INT(-8.9) is -9).',
    shared: 'src/core/coerce.ts',
    reference: [],
    naive: [
      edit('src/core/coerce.ts', `  return n instanceof FormulaError ? n : Math.trunc(n);`, `  return n instanceof FormulaError ? n : Math.floor(n);`),
    ],
    naiveFunction: [
      ["import { toNumber } from '../../core/coerce';", "import { toInteger } from '../../core/coerce';"],
      ['const n = toNumber(value);', 'const n = toInteger(value);'],
      ['return Math.floor(n);', 'return n;'],
    ],
  },
  {
    id: 'trap-NETWORKDAYS.INTL',
    fn: 'NETWORKDAYS.INTL',
    title: 'Implement NETWORKDAYS.INTL',
    ask: 'Implement NETWORKDAYS.INTL: working days between two dates with a configurable weekend (codes 1-7, 11-17 or a "0000011" mask) and holidays.',
    shared: 'src/helpers/workdays.ts',
    reference: [
      edit('src/helpers/workdays.ts', `/** True for Monday..Friday serials that are not in \`holidays\` (whole-day serials). */
export function isWorkday(serial: number, holidays: ReadonlySet<number>): boolean {
  const day = dayOfWeek(serial);
  return day !== 0 && day !== 6 && !holidays.has(Math.floor(serial));
}`, `/** The default weekend: Saturday and Sunday (days of week, 0 = Sunday). */
export const SATURDAY_SUNDAY: ReadonlySet<number> = new Set([6, 0]);

/**
 * True for serials that are not weekend days and not in \`holidays\` (whole-day serials).
 * \`weekend\` holds days of the week (0 = Sunday); Saturday and Sunday by default.
 */
export function isWorkday(serial: number, holidays: ReadonlySet<number>, weekend: ReadonlySet<number> = SATURDAY_SUNDAY): boolean {
  return !weekend.has(dayOfWeek(serial)) && !holidays.has(Math.floor(serial));
}

/**
 * The weekend argument of NETWORKDAYS.INTL / WORKDAY.INTL as days of the week (0 = Sunday):
 * omitted or 1 is Saturday+Sunday, 2..7 the pairs Sunday+Monday .. Friday+Saturday,
 * 11..17 the single days Sunday .. Saturday, or a 7-character 0/1 mask starting Monday
 * ("0000011"). #NUM! for other numbers, #VALUE! for other text.
 */
export function weekendFromCode(code: Value): ReadonlySet<number> | FormulaError {
  if (isError(code)) return code;
  if (code === null) return SATURDAY_SUNDAY;
  if (typeof code === 'string') {
    if (!/^[01]{7}$/.test(code)) return err.value;
    const days = new Set<number>();
    for (let i = 0; i < 7; i++) if (code[i] === '1') days.add((i + 1) % 7);
    return days;
  }
  if (typeof code !== 'number') return err.value;
  if (code >= 1 && code <= 7 && Number.isInteger(code)) return new Set([(code + 5) % 7, (code + 6) % 7]);
  if (code >= 11 && code <= 17 && Number.isInteger(code)) return new Set([(code - 11) % 7]);
  return err.num;
}`),
    ],
    naive: [
      edit('src/helpers/workdays.ts', `/** True for Monday..Friday serials that are not in \`holidays\` (whole-day serials). */
export function isWorkday(serial: number, holidays: ReadonlySet<number>): boolean {
  const day = dayOfWeek(serial);
  return day !== 0 && day !== 6 && !holidays.has(Math.floor(serial));
}`, `/** True for serials that are not weekend days (0 = Sunday) and not in \`holidays\`. */
export function isWorkday(serial: number, weekend: ReadonlySet<number>, holidays: ReadonlySet<number>): boolean {
  return !weekend.has(dayOfWeek(serial)) && !holidays.has(Math.floor(serial));
}

/**
 * The weekend argument of NETWORKDAYS.INTL as days of the week (0 = Sunday): omitted or 1
 * is Saturday+Sunday, 2..7 the pairs Sunday+Monday .. Friday+Saturday, 11..17 single days,
 * or a 7-character 0/1 mask starting Monday. #NUM! for other numbers, #VALUE! for other text.
 */
export function weekendFromCode(code: Value): ReadonlySet<number> | FormulaError {
  if (isError(code)) return code;
  if (code === null) return new Set([6, 0]);
  if (typeof code === 'string') {
    if (!/^[01]{7}$/.test(code)) return err.value;
    const days = new Set<number>();
    for (let i = 0; i < 7; i++) if (code[i] === '1') days.add((i + 1) % 7);
    return days;
  }
  if (typeof code !== 'number') return err.value;
  if (code >= 1 && code <= 7 && Number.isInteger(code)) return new Set([(code + 5) % 7, (code + 6) % 7]);
  if (code >= 11 && code <= 17 && Number.isInteger(code)) return new Set([(code - 11) % 7]);
  return err.num;
}`),
    ],
    naiveFunction: [['if (isWorkday(day, holidays, weekend)) count++;', 'if (isWorkday(day, weekend, holidays)) count++;']],
  },
];
