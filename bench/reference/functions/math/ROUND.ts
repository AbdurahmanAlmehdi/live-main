import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { roundHalfAwayFromZero } from '../../helpers/rounding';

/** ROUND(number, num_digits): rounds a number to num_digits digits, halves away from zero (num_digits is truncated). */
const ROUND: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, digitsValue]) {
    const n = toNumber(numberValue);
    if (isError(n)) return n;
    const digits = toInteger(digitsValue);
    if (isError(digits)) return digits;
    return roundHalfAwayFromZero(n, digits);
  },
};

export default ROUND;
