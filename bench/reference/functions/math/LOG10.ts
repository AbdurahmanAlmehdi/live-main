import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** LOG10(number): the base-10 logarithm of a positive number. */
const LOG10: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (n <= 0) return err.num;
    return Math.log10(n);
  },
};

export default LOG10;
