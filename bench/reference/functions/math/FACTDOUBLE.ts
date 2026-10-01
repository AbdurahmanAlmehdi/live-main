import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { doubleFactorial } from '../../helpers/combinatorics';

/** FACTDOUBLE(number): the double factorial of a number, truncated to an integer (-1!! is 1). */
const FACTDOUBLE: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toInteger(value);
    if (isError(n)) return n;
    if (n < -1) return err.num;
    return checkNumber(doubleFactorial(n));
  },
};

export default FACTDOUBLE;
