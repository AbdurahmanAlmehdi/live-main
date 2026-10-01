import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { variance } from '../../helpers/variance';

/** STDEV.S(number1, ...): the sample standard deviation; #DIV/0! for fewer than two numbers. */
const STDEV_S: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    const v = variance(numbers);
    return isError(v) ? v : Math.sqrt(v);
  },
};

export default STDEV_S;
