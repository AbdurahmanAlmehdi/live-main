import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** CHOOSE(index_num, value1, ...): the value at position index_num (truncated, 1-based). */
const CHOOSE: FormulaFunction = {
  minArgs: 2,
  maxArgs: Infinity,
  call([indexValue, ...values]) {
    const index = toInteger(indexValue);
    if (isError(index)) return index;
    if (index < 1 || index > values.length) return err.value;
    return values[index - 1] ?? 0;
  },
};

export default CHOOSE;
