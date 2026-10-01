import type { FormulaError, Value } from '../core/value';
import { NotImplementedError } from '../core/errors';

export interface CriteriaPair {
  range: Value;
  criterion: Value;
}

/**
 * For COUNTIFS / SUMIFS / AVERAGEIFS / MAXIFS / MINIFS: the row-major cell indices at
 * which every range satisfies its criterion. All ranges must have the same shape
 * (otherwise #VALUE!); a criterion must be a single value and errors in it are returned.
 */
export function matchingIndices(pairs: readonly CriteriaPair[]): number[] | FormulaError {
  throw new NotImplementedError('matchingIndices (src/helpers/criteriaRanges.ts)');
}
