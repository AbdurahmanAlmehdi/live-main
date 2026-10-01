import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** ASIN(number): the arcsine of a number in [-1, 1], in radians. */
const ASIN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (n < -1 || n > 1) return err.num;
    return Math.asin(n);
  },
};

export default ASIN;
