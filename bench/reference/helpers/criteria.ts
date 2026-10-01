import type { Scalar } from '../core/value';
import { isError } from '../core/errors';
import { parseNumber } from '../core/coerce';
import { compareScalars } from '../core/compare';
import { wildcardToRegExp } from './wildcard';

/** A compiled criterion: does a cell value satisfy it? */
export type Criterion = (value: Scalar) => boolean;

type Operator = '=' | '<>' | '<' | '>' | '<=' | '>=';
const OPERATOR = /^(<>|<=|>=|=|<|>)/;

function holds(op: Operator, c: number): boolean {
  switch (op) {
    case '=': return c === 0;
    case '<>': return c !== 0;
    case '<': return c < 0;
    case '>': return c > 0;
    case '<=': return c <= 0;
    case '>=': return c >= 0;
  }
}

/** Compares a cell against a number/boolean operand; only cells of the same type can match "=" or an inequality. */
function typedCriterion(op: Operator, operand: number | boolean): Criterion {
  return (value) => {
    if (typeof value !== typeof operand) return op === '<>';
    return holds(op, compareScalars(value, operand));
  };
}

/**
 * Compiles a criterion as used by COUNTIF, SUMIF, AVERAGEIF and the *IFS functions:
 *   - a number matches equal numbers; a boolean matches that boolean;
 *   - text may start with an operator (=, <>, <, >, <=, >=); the rest is read as a number
 *     when numeric ("<=10"), as a boolean when TRUE/FALSE, otherwise as text;
 *   - text operands match case-insensitively, and with = / <> they may use wildcards
 *     ("a*", "?b"); "<" / ">" compare text cells alphabetically;
 *   - "" and "=" match empty cells ("" also matches empty text); "<>" matches non-empty cells;
 *   - numeric comparisons never match text cells, and error cells only match "<>".
 */
export function parseCriterion(criterion: Scalar): Criterion {
  if (typeof criterion === 'number' || typeof criterion === 'boolean') return typedCriterion('=', criterion);
  if (criterion === null) return (value) => value === null || value === '';
  if (isError(criterion)) return (value) => isError(value) && value.code === criterion.code;
  const match = OPERATOR.exec(criterion);
  const op: Operator = match ? (match[1] as Operator) : '=';
  const rest = match ? criterion.slice(match[1].length) : criterion;
  if (rest === '') {
    if (op === '=') return match ? (value) => value === null : (value) => value === null || value === '';
    if (op === '<>') return (value) => value !== null && value !== '';
  }
  const number = parseNumber(rest);
  if (number !== null) return typedCriterion(op, number);
  const upper = rest.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return typedCriterion(op, upper === 'TRUE');
  if (op === '=' || op === '<>') {
    const pattern = wildcardToRegExp(rest);
    return (value) => {
      const matches = typeof value === 'string' && pattern.test(value);
      return op === '=' ? matches : !matches;
    };
  }
  return (value) => typeof value === 'string' && holds(op, compareScalars(value, rest));
}
