import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { skewness } from '../../helpers/shape';

/** SKEW(number1, ...): the sample skewness of the numbers. */
const SKEW: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return skewness(numbers);
  },
};

export default SKEW;
