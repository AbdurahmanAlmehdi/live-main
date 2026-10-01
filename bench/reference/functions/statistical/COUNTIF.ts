import type { FormulaFunction } from '../../core/types';
import { cellsOf } from '../../core/range';
import { err, isError } from '../../core/errors';
import { parseCriterion } from '../../helpers/criteria';

/** COUNTIF(range, criteria): how many cells meet the criteria. */
const COUNTIF: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([range, criterion]) {
    if (isError(criterion)) return criterion;
    const criterionCells = cellsOf(criterion);
    if (criterionCells.length !== 1) return err.value;
    const matches = parseCriterion(criterionCells[0]);
    return cellsOf(range).filter((cell) => matches(cell)).length;
  },
};

export default COUNTIF;
