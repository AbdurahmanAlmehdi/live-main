import type { FormulaFunction } from '../../core/types';
import { checkNumber, toNumber } from '../../core/coerce';
import { err, isError } from '../../core/errors';

/** COT(number): the cotangent of an angle in radians. */
const COT: FormulaFunction = {
  minArgs: 1,
  maxArgs: 1,
  call([value]) {
    const n = toNumber(value);
    if (isError(n)) return n;
    if (n === 0) return err.div0;
    return checkNumber(1 / Math.tan(n));
  },
};

export default COT;
