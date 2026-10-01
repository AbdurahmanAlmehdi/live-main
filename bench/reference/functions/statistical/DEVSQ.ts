import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';
import { sumOfSquaredDeviations } from '../../helpers/moments';

/** DEVSQ(number1, ...): the sum of squared deviations from the mean; #NUM! when there are no numbers. */
const DEVSQ: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    if (numbers.length === 0) return err.num;
    return sumOfSquaredDeviations(numbers);
  },
};

export default DEVSQ;
