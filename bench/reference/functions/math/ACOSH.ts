import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** ACOSH(number): the inverse hyperbolic cosine of a number >= 1. */
const ACOSH: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (n < 1) return err.num;
    return Math.acosh(n);
  },
};

export default ACOSH;
