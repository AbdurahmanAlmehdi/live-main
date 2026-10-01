import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { checkNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** PRODUCT(number1, ...): multiplies the numbers in the arguments (0 when there are none). */
const PRODUCT: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    if (numbers.length === 0) return 0;
    return checkNumber(numbers.reduce((product, n) => product * n, 1));
  },
};

export default PRODUCT;
