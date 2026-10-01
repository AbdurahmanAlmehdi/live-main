import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { skewness } from '../../helpers/shape';

/** SKEW.P(number1, ...): the population skewness of the numbers. */
const SKEW_P: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return skewness(numbers, { population: true });
  },
};

export default SKEW_P;
