import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** LN(number): the natural logarithm of a positive number. */
const LN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (n <= 0) return err.num;
    return Math.log(n);
  },
};

export default LN;
