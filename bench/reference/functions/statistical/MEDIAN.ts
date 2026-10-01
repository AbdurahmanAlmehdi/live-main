import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { isError } from '../../core/errors';
import { percentileInclusive } from '../../helpers/quantile';

/** MEDIAN(number1, ...): the middle number (the mean of the two middle numbers for an even count). */
const MEDIAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    return percentileInclusive(numbers, 0.5);
  },
};

export default MEDIAN;
