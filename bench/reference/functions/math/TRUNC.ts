import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { isError } from '../../core/errors';
import { roundTowardZero } from '../../helpers/rounding';

/** TRUNC(number, [num_digits]): truncates toward zero to num_digits digits (0 by default). */
const TRUNC: FormulaFunction = {
  minArgs: 1,
  maxArgs: 2,
  call(args) {
    const n = toNumber(args[0]);
    if (isError(n)) return n;
    const digits = optionalInteger(args, 1, 0);
    if (isError(digits)) return digits;
    return roundTowardZero(n, digits);
  },
};

export default TRUNC;
