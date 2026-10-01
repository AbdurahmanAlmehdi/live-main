import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { roundAwayFromZero } from '../../helpers/rounding';

/** ROUNDUP(number, num_digits): rounds a number away from zero to num_digits digits (num_digits is truncated). */
const ROUNDUP: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, digitsValue]) {
    const n = toNumber(numberValue);
    if (isError(n)) return n;
    const digits = toInteger(digitsValue);
    if (isError(digits)) return digits;
    return roundAwayFromZero(n, digits);
  },
};

export default ROUNDUP;
