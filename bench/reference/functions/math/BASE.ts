import type { FormulaFunction } from '../../core/types';
import { toInteger } from '../../core/coerce';
import { optionalInteger } from '../../core/args';
import { err, isError } from '../../core/errors';
import { formatUnsigned } from '../../helpers/radixFormat';

/** BASE(number, radix, [min_length]): a non-negative integer written in base radix (2..36), zero-padded to min_length. */
const BASE: FormulaFunction = {
  minArgs: 2,
  maxArgs: 3,
  call(args) {
    const n = toInteger(args[0]);
    if (isError(n)) return n;
    const radix = toInteger(args[1]);
    if (isError(radix)) return radix;
    const minLength = optionalInteger(args, 2, 0);
    if (isError(minLength)) return minLength;
    if (n < 0 || n >= 2 ** 53 || radix < 2 || radix > 36 || minLength < 0 || minLength > 255) return err.num;
    return formatUnsigned(n, radix, minLength);
  },
};

export default BASE;
