import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { mean } from '../../helpers/moments';

/** AVERAGE(number1, ...): the arithmetic mean of the numbers; #DIV/0! when there are none. */
const AVERAGE: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return mean(numbers);
  },
};

export default AVERAGE;
