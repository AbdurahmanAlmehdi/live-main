import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** SQRTPI(number): the square root of number * pi. */
const SQRTPI: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (n < 0) return err.num;
    return Math.sqrt(n * Math.PI);
  },
};

export default SQRTPI;
