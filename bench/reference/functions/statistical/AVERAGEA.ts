import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { mean } from '../../helpers/moments';

/**
 * AVERAGEA(value1, ...): the mean of all values; inside arrays text counts as 0 and
 * booleans as 1 or 0. #DIV/0! when there are no values.
 */
const AVERAGEA: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args, { rangeValues: 'all' });
    if (isError(numbers)) return numbers;
    return mean(numbers);
  },
};

export default AVERAGEA;
