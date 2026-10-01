import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { checkNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** SUMSQ(number1, ...): the sum of the squares of the numbers in the arguments. */
const SUMSQ: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return checkNumber(numbers.reduce((total, n) => total + n * n, 0));
  },
};

export default SUMSQ;
