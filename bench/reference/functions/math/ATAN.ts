import type { FormulaFunction } from '../../core/types';
import { toNumber } from '../../core/coerce';
import { isError } from '../../core/errors';

/** ATAN(number): the arctangent of a number, in radians. */
const ATAN: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    return Math.atan(n);
  },
};

export default ATAN;
