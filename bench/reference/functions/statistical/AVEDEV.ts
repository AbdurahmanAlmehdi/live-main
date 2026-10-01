import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { err, isError } from '../../core/errors';
import { mean } from '../../helpers/moments';

/** AVEDEV(number1, ...): the mean absolute deviation from the mean; #NUM! when there are no numbers. */
const AVEDEV: FormulaFunction = {
  minArgs: 1,
  maxArgs: Infinity,
  call(args) {
    const numbers = collectNumbers(args);
    if (isError(numbers)) return numbers;
    if (numbers.length === 0) return err.num;
    const m = mean(numbers) as number;
    return numbers.reduce((total, n) => total + Math.abs(n - m), 0) / numbers.length;
  },
};

export default AVEDEV;
