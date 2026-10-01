import type { FormulaFunction } from '../../core/types';
import { toInteger, toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';
import { roundTowardZero } from '../../helpers/rounding';

/** ROUNDDOWN(number, num_digits): rounds a number toward zero to num_digits digits (num_digits is truncated). */
const ROUNDDOWN: FormulaFunction = {
  minArgs: 2,
  maxArgs: 2,
  call([numberValue, digitsValue]) {
    const n = toNumber(numberValue);
    if (isError(n)) return n;
    const digits = toInteger(digitsValue);
    if (isError(digits)) return digits;
    return roundTowardZero(n, digits);
  },
};

export default ROUNDDOWN;
