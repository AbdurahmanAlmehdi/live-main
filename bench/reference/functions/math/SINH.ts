import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** SINH(number): the hyperbolic sine of a number. */
const SINH: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return checkNumber(Math.sinh(n));
  },
};

export default SINH;
