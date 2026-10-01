import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';

/** GEOMEAN(number1, ...): the geometric mean of positive numbers. */
const GEOMEAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    if (numbers.length === 0 || numbers.some((n) => n <= 0)) return err.num;
    const logSum = numbers.reduce((total, n) => total + Math.log(n), 0);
    return Math.exp(logSum / numbers.length);
  },
};

export default GEOMEAN;
