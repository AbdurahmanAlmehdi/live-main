import type { FormulaFunction } from '../../core/types';
import { cellsOf, dimensions } from '../../core/range';
import { checkNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { matchingIndices, type CriteriaPair } from '../../helpers/criteriaRanges';

/** SUMIFS(sum_range, criteria_range1, criteria1, ...): adds the sum_range cells meeting every criterion. */
const SUMIFS: FormulaFunction = {
  minArgs: 3,
  maxArgs: Infinity,
  call([sumRange, ...rest]) {
    if (rest.length % 2 !== 0) return err.value;
    const pairs: CriteriaPair[] = [];
    for (let i = 0; i < rest.length; i += 2) pairs.push({ range: rest[i], criterion: rest[i + 1] });
    const [height, width] = dimensions(sumRange);
    const [criteriaHeight, criteriaWidth] = dimensions(pairs[0].range);
    if (height !== criteriaHeight || width !== criteriaWidth) return err.value;
    const indices = matchingIndices(pairs);
    if (isError(indices)) return indices;
    const cells = cellsOf(sumRange);
    let total = 0;
    for (const i of indices) {
      const cell = cells[i];
      if (isError(cell)) return cell;
      if (typeof cell === 'number') total += cell;
    }
    return checkNumber(total);
  },
};

export default SUMIFS;
