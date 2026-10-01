import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';

/** MAX(number1, ...): the largest number (0 when there are none). */
const MAX: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return numbers.length === 0 ? 0 : Math.max(...numbers);
  },
};

export default MAX;
