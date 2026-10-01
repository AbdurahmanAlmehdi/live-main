import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** COSH(number): the hyperbolic cosine of a number. */
const COSH: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return checkNumber(Math.cosh(n));
  },
};

export default COSH;
