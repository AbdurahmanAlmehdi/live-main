import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { variance } from '../../helpers/variance';

/** VAR.S(number1, ...): the sample variance; #DIV/0! for fewer than two numbers. */
const VAR_S: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return variance(numbers);
  },
};

export default VAR_S;
