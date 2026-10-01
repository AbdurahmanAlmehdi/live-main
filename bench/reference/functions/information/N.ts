import type { FormulaFunction } from '../../core/types';
import { isRange } from '../../core/value';
import { isError } from '../../core/errors';

/** N(value): numbers stay, TRUE is 1, FALSE and text are 0, errors pass through; an array gives its first cell. */
const N: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const cell = isRange(value) ? value.at(0, 0) : value;
    if (isError(cell)) return cell;
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'boolean') return cell ? 1 : 0;
    return 0;
  },
};

export default N;
