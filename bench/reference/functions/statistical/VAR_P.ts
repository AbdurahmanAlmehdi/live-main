import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { variance } from '../../helpers/variance';

/** VAR.P(number1, ...): the population variance; #DIV/0! when there are no numbers. */
const VAR_P: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return variance(numbers, { population: true });
  },
};

export default VAR_P;
