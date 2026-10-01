import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { kurtosis } from '../../helpers/shape';

/** KURT(number1, ...): the sample excess kurtosis of the numbers. */
const KURT: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return kurtosis(numbers);
  },
};

export default KURT;
