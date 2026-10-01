import type { FormulaFunction } from '../../core/types';
import { checkNumber, toInteger } from '../../core/coerce';
import { err, isError } from '../../core/errors';
import { factorial } from '../../helpers/combinatorics';

/** FACT(number): the factorial of a number, truncated to an integer. */
const FACT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toInteger(value);
    if (isError(n)) return n;
    if (n < 0) return err.num;
    return checkNumber(factorial(n));
  },
};

export default FACT;
