import type { FormulaFunction } from '../../core/types';
import { cellsOf } from '../../core/range';
import { checkNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { parseCriterion } from '../../helpers/criteria';

/**
 * SUMIF(range, criteria, [sum_range]): adds the cells of sum_range (or range) whose
 * corresponding range cell meets the criteria. Only numbers are added.
 */
const SUMIF: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const [range, criterion] = args;
    if (isError(criterion)) return criterion;
    const tested = cellsOf(range);
    const summed = args.length > 2 && args[2] !== null ? cellsOf(args[2]) : tested;
    const criterionCells = cellsOf(criterion);
    if (criterionCells.length !== 1) return err.value;
    const matches = parseCriterion(criterionCells[0]);
    let total = 0;
    for (let i = 0; i < tested.length; i++) {
      if (!matches(tested[i])) continue;
      const cell = summed[i];
      if (isError(cell)) return cell;
      if (typeof cell === 'number') total += cell;
    }
    return checkNumber(total);
  },
};

export default SUMIF;
