import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { checkNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** SUM(number1, ...): adds the numbers in the arguments. */
const SUM: FormulaFunction = {
  minArgs: 0,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    let total = 0;
    for (const n of numbers) total += n;
    return checkNumber(total);
  },
};

export default SUM;
