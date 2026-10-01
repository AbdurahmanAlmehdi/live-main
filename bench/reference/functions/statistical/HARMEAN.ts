import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';

/** HARMEAN(number1, ...): the harmonic mean of positive numbers. */
const HARMEAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    if (numbers.length === 0 || numbers.some((n) => n <= 0)) return err.num;
    return numbers.length / numbers.reduce((total, n) => total + 1 / n, 0);
  },
};

export default HARMEAN;
