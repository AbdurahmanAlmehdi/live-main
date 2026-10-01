import type { FormulaFunction } from '../../core/types';
import { cellsOf } from '../../core/range';
import { err, isError } from '../../core/errors';
import { parseCriterion } from '../../helpers/criteria';
import { mean } from '../../helpers/moments';

/** AVERAGEIF(range, criteria, [average_range]): the mean of the numbers whose range cell meets the criteria. */
const AVERAGEIF: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const [range, criterion] = args;
    if (isError(criterion)) return criterion;
    const criterionCells = cellsOf(criterion);
    if (criterionCells.length !== 1) return err.value;
    const matches = parseCriterion(criterionCells[0]);
    const tested = cellsOf(range);
    const averaged = args.length > 2 && args[2] !== null ? cellsOf(args[2]) : tested;
    const numbers: number[] = [];
    for (let i = 0; i < tested.length; i++) {
      if (!matches(tested[i])) continue;
      const cell = averaged[i];
      if (isError(cell)) return cell;
      if (typeof cell === 'number') numbers.push(cell);
    }
    return mean(numbers);
  },
};

export default AVERAGEIF;
