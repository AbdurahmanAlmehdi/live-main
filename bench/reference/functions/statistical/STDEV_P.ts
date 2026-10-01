import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';
import { sumOfSquaredDeviations } from '../../helpers/moments';

/** STDEV.P(number1, ...): the population standard deviation; #DIV/0! when there are no numbers. */
const STDEV_P: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    if (numbers.length === 0) return err.div0;
    return Math.sqrt(sumOfSquaredDeviations(numbers) / numbers.length);
  },
};

export default STDEV_P;
