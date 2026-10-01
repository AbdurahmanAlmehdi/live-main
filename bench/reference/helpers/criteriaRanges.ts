import type { FormulaError, Scalar, Value } from '../core/value';
import { err, isError } from '../core/errors';
import { cellsOf, dimensions } from '../core/range';
import { parseCriterion, type Criterion } from './criteria';

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
  if (pairs.length === 0) return err.value;
  const [height, width] = dimensions(pairs[0].range);
  const tests: { cells: Scalar[]; matches: Criterion }[] = [];
  for (const { range, criterion } of pairs) {
    const [h, w] = dimensions(range);
    if (h !== height || w !== width) return err.value;
    const criterionCells = cellsOf(criterion);
    if (criterionCells.length !== 1) return err.value;
    const [crit] = criterionCells;
    if (isError(crit)) return crit;
    tests.push({ cells: cellsOf(range), matches: parseCriterion(crit) });
  }
  const indices: number[] = [];
  for (let i = 0; i < height * width; i++) {
    if (tests.every((t) => t.matches(t.cells[i]))) indices.push(i);
  }
  return indices;
}
