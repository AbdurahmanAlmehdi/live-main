/**
 * Helper tasks: each implements one stubbed module in demo-repo/src/helpers (whose stub is
 * derived from bench/reference/helpers/<file>.ts by scripts/make-stubs.ts) and is tested by
 * demo-repo/tests/helpers/<file>.test.ts. Dependencies between helpers, and from functions
 * to helpers, are derived from imports by build-bank.
 */

export interface HelperDef {
  id: string;
  /** Module name under src/helpers (without .ts). */
  file: string;
  category: string;
  title: string;
  /** The ticket text, without solution hints beyond the documented contract. */
  ask: string;
}

const h = (file: string, category: string, title: string, ask: string): HelperDef => ({
  id: `helper-${file}`,
  file,
  category,
  title,
  ask,
});

export const HELPERS: HelperDef[] = [
  h('rounding', 'math', 'Decimal rounding helpers', 'Implement decimal rounding (half away from zero, away from zero, toward zero) that works on the decimal value of a number, so that 2.675 rounds to 2.68 at two digits.'),
  h('multiples', 'math', 'Round to multiples helpers', 'Implement rounding a number down, up, or to the nearest multiple of a positive step, robust against binary floating-point noise.'),
  h('gcd', 'math', 'GCD / LCM helpers', 'Implement greatest common divisor and least common multiple of non-negative integers.'),
  h('combinatorics', 'math', 'Combinatorics helpers', 'Implement factorial, double factorial, combinations and permutations for non-negative integers.'),
  h('roman', 'math', 'Roman numeral helpers', 'Implement conversion between integers and classic roman numerals in both directions.'),
  h('radixParse', 'engineering', 'Radix parsing helper', 'Implement parsing of numbers written in another base, including the 10-digit two\'s complement convention the engineering conversion functions use.'),
  h('radixFormat', 'engineering', 'Radix formatting helper', 'Implement formatting of integers in base 2, 8 or 16 with optional zero padding and 10-digit two\'s complement for negative numbers.'),
  h('complexParse', 'engineering', 'Complex number parsing helper', 'Implement parsing of complex numbers written as text ("3+4i", "-2j", ...) for the IM* functions.'),
  h('complexFormat', 'engineering', 'Complex number formatting helper', 'Implement the text form of complex numbers as the IM* functions return them.'),
  h('bits', 'engineering', 'Bitwise operand helper', 'Implement validation/coercion of operands for the BIT* functions.'),
  h('moments', 'statistical', 'Mean and squared deviations helpers', 'Implement the arithmetic mean and the sum of squared deviations from the mean.'),
  h('variance', 'statistical', 'Variance helper', 'Implement the variance helper used by the variance and standard deviation functions.'),
  h('shape', 'statistical', 'Skewness and kurtosis helpers', 'Implement sample skewness and sample excess kurtosis.'),
  h('quantile', 'statistical', 'Percentile helper', 'Implement the inclusive percentile with linear interpolation.'),
  h('rank', 'statistical', 'Rank helper', 'Implement ranking a value within a list of numbers.'),
  h('pairs', 'statistical', 'Paired data helper', 'Implement pairing up two arrays for two-variable statistics, keeping only pairs where both values are numbers.'),
  h('gamma', 'statistical', 'Gamma function helpers', 'Implement the gamma function and its natural logarithm with about 15 significant digits.'),
  h('incompleteGamma', 'statistical', 'Incomplete gamma helpers', 'Implement the regularized lower and upper incomplete gamma functions.'),
  h('incompleteBeta', 'statistical', 'Incomplete beta helper', 'Implement the regularized incomplete beta function.'),
  h('erf', 'statistical', 'Error function helpers', 'Implement the error function and the complementary error function, accurate in the tails.'),
  h('normal', 'statistical', 'Standard normal distribution helpers', 'Implement the standard normal density, cumulative distribution and its inverse.'),
  h('wildcard', 'lookup', 'Wildcard pattern helpers', 'Implement spreadsheet wildcard patterns (* ? and ~ escapes) as case-insensitive whole-text matchers.'),
  h('criteria', 'lookup', 'Criteria parsing helper', 'Implement compiling a criterion ("<=10", "a*", 5, "<>", ...) into a predicate, as used by COUNTIF / SUMIF and friends.'),
  h('criteriaRanges', 'lookup', 'Multi-criteria matching helper', 'Implement finding the cells that satisfy several (range, criterion) pairs, as used by the *IFS functions.'),
  h('lookupExact', 'lookup', 'Exact-match lookup helper', 'Implement the exact-match search used by MATCH, VLOOKUP and HLOOKUP.'),
  h('lookupApprox', 'lookup', 'Approximate-match lookup helper', 'Implement the approximate-match search over sorted data used by MATCH, VLOOKUP, HLOOKUP and LOOKUP.'),
  h('fixedFormat', 'text', 'Fixed-decimals formatting helper', 'Implement formatting a number with a fixed number of decimals and optional thousands separators.'),
  h('textFormat', 'text', 'Number format code helper', 'Implement formatting numbers, dates and times with spreadsheet format codes (the subset documented in the module).'),
  h('dateSerial', 'date', 'Date serial number helpers', 'Implement conversion between calendar dates and date serial numbers in the 1900 date system.'),
  h('timeOfDay', 'date', 'Time of day helpers', 'Implement conversion between times of day and fractions of a day.'),
  h('dateParse', 'date', 'Date and time text parsing helpers', 'Implement reading dates and times written as text.'),
  h('weekday', 'date', 'Weekday helpers', 'Implement day-of-week numbering and week-of-year computation.'),
  h('addMonths', 'date', 'Month arithmetic helpers', 'Implement adding months to a date and finding the end of a month.'),
  h('dayCount', 'date', 'Day-count convention helpers', 'Implement the 30/360 day count and the year-fraction day-count bases.'),
  h('workdays', 'date', 'Working day helpers', 'Implement working-day checks and reading a holiday list argument.'),
  h('annuity', 'financial', 'Annuity (time value of money) helpers', 'Implement future value, present value, payment and interest payment for level annuities.'),
  h('solver', 'financial', 'Root-finding helper', 'Implement a Newton root finder used by the iterative financial functions.'),
  h('cashflows', 'financial', 'Cash-flow helpers', 'Implement reading a cash-flow argument and the net present value of a series of flows.'),
];
