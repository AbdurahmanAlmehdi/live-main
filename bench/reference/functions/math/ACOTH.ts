import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** ACOTH(number): the inverse hyperbolic cotangent of a number with |n| > 1. */
const ACOTH: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (Math.abs(n) <= 1) return err.num;
    return 0.5 * Math.log((n + 1) / (n - 1));
  },
};

export default ACOTH;
