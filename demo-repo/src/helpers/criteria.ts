import type { Scalar } from '../core/value';
import { NotImplementedError } from '../core/errors';

/** A compiled criterion: does a cell value satisfy it? */
export type Criterion = (value: Scalar) => boolean;

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
  throw new NotImplementedError('parseCriterion (src/helpers/criteria.ts)');
}
