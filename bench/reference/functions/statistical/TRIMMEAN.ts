import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { mean } from '../../helpers/moments';

/**
 * TRIMMEAN(array, percent): the mean after dropping floor(n * percent / 2) numbers from
 * each end. percent must be in [0, 1).
 */
const TRIMMEAN: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([array, percentValue]) {
    const numbers = collectNumbers([array]);
    if (isError(numbers)) return numbers;
    const percent = toNumber(percentValue);
    if (isError(percent)) return percent;
    if (percent < 0 || percent >= 1 || numbers.length === 0) return err.num;
    const drop = Math.floor((numbers.length * percent) / 2);
    const sorted = [...numbers].sort((a, b) => a - b);
    return mean(sorted.slice(drop, sorted.length - drop));
  },
};

export default TRIMMEAN;
