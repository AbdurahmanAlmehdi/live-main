import type { FormulaFunction } from '../../core/types';
import { cellsOf, dimensions } from '../../core/range';
import { err, isError } from '../../core/errors';
import { matchingIndices, type CriteriaPair } from '../../helpers/criteriaRanges';

/** MAXIFS(range, criteria_range1, criteria1, ...): the largest max_range number meeting every criterion (0 when none do). */
const MAXIFS: FormulaFunction = {
  minArgs: 3,
  maxArgs: Infinity,
  call([valueRange, ...rest]) {
    if (rest.length % 2 !== 0) return err.value;
    const pairs: CriteriaPair[] = [];
    for (let i = 0; i < rest.length; i += 2) pairs.push({ range: rest[i], criterion: rest[i + 1] });
    const [height, width] = dimensions(valueRange);
    const [criteriaHeight, criteriaWidth] = dimensions(pairs[0].range);
    if (height !== criteriaHeight || width !== criteriaWidth) return err.value;
    const indices = matchingIndices(pairs);
    if (isError(indices)) return indices;
    const cells = cellsOf(valueRange);
    const numbers: number[] = [];
    for (const i of indices) {
      const cell = cells[i];
      if (isError(cell)) return cell;
      if (typeof cell === 'number') numbers.push(cell);
    }
    return numbers.length === 0 ? 0 : Math.max(...numbers);
  },
};

export default MAXIFS;
