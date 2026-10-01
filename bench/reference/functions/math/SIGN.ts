import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** SIGN(number): 1, 0 or -1 according to the sign of a number. */
const SIGN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return Math.sign(n);
  },
};

export default SIGN;
