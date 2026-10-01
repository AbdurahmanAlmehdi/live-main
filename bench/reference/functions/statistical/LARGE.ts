import type { FormulaFunction } from '../../core/types';
import { collectNumbers } from '../../core/args';
import { toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** LARGE(array, k): the k-th largest number. */
const LARGE: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([array, kValue]) {
    const numbers = collectNumbers([array]);
    if (isError(numbers)) return numbers;
    const k = toInteger(kValue);
    if (isError(k)) return k;
    if (k < 1 || k > numbers.length) return err.num;
    return [...numbers].sort((a, b) => b - a)[k - 1];
  },
};

export default LARGE;
