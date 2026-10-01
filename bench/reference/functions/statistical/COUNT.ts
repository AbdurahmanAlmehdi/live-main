import type { FormulaFunction } from '../../core/types';
import { isRange } from '../../core/value';
import { cellsOf } from '../../core/range';
import { parseNumber } from '../../core/coerce';

/**
 * COUNT(value1, ...): how many numbers there are. Inside arrays only numbers count;
 * typed directly, numeric text and booleans count too. Errors are skipped.
 */
const COUNT: FormulaFunction = {
  minArgs: 0,
  maxArgs: Infinity,
  call(args) {
    let count = 0;
    for (const arg of args) {
      if (isRange(arg)) {
        count += cellsOf(arg).filter((cell) => typeof cell === 'number').length;
      } else if (typeof arg === 'number' || typeof arg === 'boolean') {
        count++;
      } else if (typeof arg === 'string' && parseNumber(arg) !== null) {
        count++;
      }
    }
    return count;
  },
};

export default COUNT;
