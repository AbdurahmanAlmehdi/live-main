import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';

/** MIN(number1, ...): the smallest number (0 when there are none). */
const MIN: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return numbers.length === 0 ? 0 : Math.min(...numbers);
  },
};

export default MIN;
